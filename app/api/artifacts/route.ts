import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { DateTime } from 'luxon';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fromTimeParam = searchParams.get('fromTime');
    const toTimeParam = searchParams.get('toTime');
    const envParam = searchParams.get('env') || 'dev';
    
    if (!toTimeParam) {
      return NextResponse.json(
        { error: 'toTime parameter is required' },
        { status: 400 }
      );
    }

    // Parse time parameters
    const toTime = new Date(toTimeParam);
    const fromTime = fromTimeParam ? new Date(fromTimeParam) : null;
    
    if (isNaN(toTime.getTime())) {
      return NextResponse.json(
        { error: 'Invalid toTime format. Expected ISO 8601 format' },
        { status: 400 }
      );
    }
    
    if (fromTime && isNaN(fromTime.getTime())) {
      return NextResponse.json(
        { error: 'Invalid fromTime format. Expected ISO 8601 format' },
        { status: 400 }
      );
    }

    // Convert to timestamps for comparison
    const fromTs = fromTime ? Math.floor(fromTime.getTime() / 1000) : 0;
    const toTs = Math.floor(toTime.getTime() / 1000);

    // Connect to MongoDB with appropriate URI based on env
    const db = await getDatabase(envParam === 'prod' ? 'MONGODB_URI_PROD' : 'MONGODB_URI');
    
    const collection = db.collection('artifacts');

    const results = [];

    // Use MongoDB aggregation pipeline for proper date range filtering
    const pipeline: any[] = [
      // Stage 1: Match documents with valid created_at field
      {
        $match: {
          created_at: { $exists: true, $nin: [null, ""] }
        }
      },
      // Stage 2: Parse the created_at string and convert to proper date
      {
        $addFields: {
          parsed_date: {
            $dateFromString: {
              dateString: {
                $concat: [
                  "20", // Add "20" prefix for year
                  { $substr: [{ $substr: ["$created_at", 6, 2] }, 0, 2] }, // Extract year (YY)
                  "-",
                  { $substr: [{ $substr: ["$created_at", 3, 2] }, 0, 2] }, // Extract month (MM)
                  "-",
                  { $substr: ["$created_at", 0, 2] }, // Extract day (DD)
                  "T",
                  { $substr: [{ $substr: ["$created_at", 9, 8] }, 0, 8] }, // Extract time (HH:MM:SS)
                  "Z"
                ]
              },
              format: "%Y-%m-%dT%H:%M:%SZ",
              onError: null,
              onNull: null
            }
          }
        }
      },
      // Stage 3: Filter by date range using proper date comparison
      {
        $match: {
          parsed_date: {
            $ne: null,
            $gte: fromTime,
            $lte: toTime
          }
        }
      },
      // Stage 4: Sort by date descending
      {
        $sort: { parsed_date: -1 }
      },
      // Stage 5: Limit results
      {
        $limit: 1000
      }
    ];

    const cursor = collection.aggregate(pipeline);
    
    for await (const doc of cursor) {
      // Parse created_at for display formatting
      const created_at_str = doc.created_at || '';
      let date_str = null;
      let time_str = null;
      
      if (created_at_str) {
        try {
          const dt_obj = DateTime.fromFormat(created_at_str, "dd/MM/yy HH:mm:ss", { zone: 'utc' });
          if (dt_obj.isValid) {
            // Format for display
            date_str = dt_obj.toFormat('yyyy-MM-dd');
            time_str = dt_obj.toFormat('HH:mm:ss');
          }
        } catch (error) {
          console.error(`Error parsing date '${created_at_str}':`, error);
        }
      }
      
      // Extract nested data from artifactData with type safety
      const artifact_data = doc.artifactData || {};
      
      // Get user story type from userStorySnapshot with type safety
      let user_story_type = '';
      if (artifact_data && 
          typeof artifact_data === 'object' && 
          'userStorySnapshot' in artifact_data && 
          Array.isArray(artifact_data.userStorySnapshot) && 
          artifact_data.userStorySnapshot.length > 0 && 
          typeof artifact_data.userStorySnapshot[0] === 'object' &&
          artifact_data.userStorySnapshot[0] !== null) {
        
        user_story_type = (artifact_data.userStorySnapshot[0] as any).title || '';
      }
      
      // Get project name from selectedProjectSnapShot with type safety
      let project_name = '';
      if (artifact_data && 
          typeof artifact_data === 'object' && 
          'selectedProjectSnapShot' in artifact_data && 
          typeof artifact_data.selectedProjectSnapShot === 'object' && 
          artifact_data.selectedProjectSnapShot !== null) {
        
        project_name = (artifact_data.selectedProjectSnapShot as any).name || '';
      }
      
      // Build the result JSON object
      const result_json = {
        artifact_id: doc.artifactId || '',
        artifact_title: doc.artifactTitle || '',
        artifact_title_ids: doc.artifactTitleIDs || [],
        date: date_str,
        time: time_str,
        user_email: doc.userEmail || '',
        mode_name: doc.modeName || '',
        widget_name: doc.widgetName || '',
        project_name: project_name,
        user_story_type: user_story_type,
        status: "success",
        created_at: doc.created_at || '',
        updated_at: doc.updated_at || '',
      };
      
      results.push(result_json);
    }

    return NextResponse.json(results);

  } catch (error) {
    console.error('Error in artifacts API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Endpoint for paginated data with filtering
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      limit = 10, 
      skip = 0, 
      env = 'dev',
      timeParams = '',  // Time filter params
      filters = {} // Additional filters (status, template, search)
    } = body;

    // Parse time parameters if provided
    let fromTime = null;
    let toTime = null;

    if (timeParams) {
      const timeParamsObj = new URLSearchParams(timeParams);
      const fromTimeParam = timeParamsObj.get('fromTime');
      const toTimeParam = timeParamsObj.get('toTime');

      if (fromTimeParam) {
        fromTime = new Date(fromTimeParam);
        if (isNaN(fromTime.getTime())) {
          fromTime = null;
        }
      }

      if (toTimeParam) {
        toTime = new Date(toTimeParam);
        if (isNaN(toTime.getTime())) {
          toTime = null;
        }
      }
    }

    // Connect to MongoDB with appropriate URI based on env
    const db = await getDatabase(env === 'prod' ? 'MONGODB_URI_PROD' : 'MONGODB_URI');
    const collection = db.collection('artifacts');

    // Build match conditions
    const matchConditions: any = {
      created_at: { $exists: true, $nin: [null, ""] }
    };

    // Add status filter if provided
    if (filters.status) {
      matchConditions.status = filters.status;
    }

    // Add template filter if provided
    if (filters.template) {
      matchConditions.modeName = filters.template;
    }

    // Add search filter if provided
    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      matchConditions.$or = [
        { artifactTitle: searchRegex },
        { userEmail: searchRegex },
        { modeName: searchRegex },
        // Add other searchable fields as needed
      ];
    }

    // Build aggregation pipeline
    const pipeline: any[] = [
      // Stage 1: Match documents with basic conditions
      {
        $match: matchConditions
      },
      // Stage 2: Parse the created_at string and convert to proper date
      {
        $addFields: {
          parsed_date: {
            $dateFromString: {
              dateString: {
                $concat: [
                  "20", // Add "20" prefix for year
                  { $substr: [{ $substr: ["$created_at", 6, 2] }, 0, 2] }, // Extract year (YY)
                  "-",
                  { $substr: [{ $substr: ["$created_at", 3, 2] }, 0, 2] }, // Extract month (MM)
                  "-",
                  { $substr: ["$created_at", 0, 2] }, // Extract day (DD)
                  "T",
                  { $substr: [{ $substr: ["$created_at", 9, 8] }, 0, 8] }, // Extract time (HH:MM:SS)
                  "Z"
                ]
              },
              format: "%Y-%m-%dT%H:%M:%SZ",
              onError: null,
              onNull: null
            }
          }
        }
      }
    ];

    // Add time filter if provided
    if (fromTime && toTime) {
      pipeline.push({
        $match: {
          parsed_date: {
            $ne: null,
            $gte: fromTime,
            $lte: toTime
          }
        }
      });
    }

    // Add facet for getting total count and paginated data in one query
    pipeline.push({
      $facet: {
        total: [{ $count: 'count' }],
        data: [
          { $sort: { parsed_date: -1 } }, // Sort by date descending
          { $skip: skip },
          { $limit: limit }
        ]
      }
    });

    const [result] = await collection.aggregate(pipeline).toArray();
    
    // Process the results
    const totalCount = result.total.length > 0 ? result.total[0].count : 0;
    const artifacts = result.data || [];

    // Process each artifact
    const processedData = artifacts.map((doc: { created_at: string; artifactData: {}; _id: { toString: () => any; }; artifactId: any; artifactTitle: any; artifactTitleIDs: any; userEmail: any; modeName: any; widgetName: any; updated_at: any; }) => {
      // Parse created_at for display formatting
      const created_at_str = doc.created_at || '';
      let date_str = null;
      let time_str = null;
      
      if (created_at_str) {
        try {
          const dt_obj = DateTime.fromFormat(created_at_str, "dd/MM/yy HH:mm:ss", { zone: 'utc' });
          if (dt_obj.isValid) {
            date_str = dt_obj.toFormat('yyyy-MM-dd');
            time_str = dt_obj.toFormat('HH:mm:ss');
          }
        } catch (error) {
          console.error(`Error parsing date '${created_at_str}':`, error);
        }
      }
      
      // Extract nested data from artifactData with type safety
      const artifact_data = doc.artifactData || {};
      
      // Get user story type from userStorySnapshot with type safety
      let user_story_type = '';
      if (artifact_data && 
          typeof artifact_data === 'object' && 
          'userStorySnapshot' in artifact_data && 
          Array.isArray(artifact_data.userStorySnapshot) && 
          artifact_data.userStorySnapshot.length > 0 && 
          typeof artifact_data.userStorySnapshot[0] === 'object' &&
          artifact_data.userStorySnapshot[0] !== null) {
        
        user_story_type = (artifact_data.userStorySnapshot[0] as any).title || '';
      }
      
      // Get project name from selectedProjectSnapShot with type safety
      let project_name = '';
      if (artifact_data && 
          typeof artifact_data === 'object' && 
          'selectedProjectSnapShot' in artifact_data && 
          typeof artifact_data.selectedProjectSnapShot === 'object' && 
          artifact_data.selectedProjectSnapShot !== null) {
        
        project_name = (artifact_data.selectedProjectSnapShot as any).name || '';
      }
      
      // Build the result JSON object
      return {
        artifact_id: doc.artifactId || '',
        artifact_title: doc.artifactTitle || '',
        artifact_title_ids: doc.artifactTitleIDs || [],
        date: date_str,
        time: time_str,
        user_email: doc.userEmail || '',
        mode_name: doc.modeName || '',
        widget_name: doc.widgetName || '',
        project_name: project_name,
        user_story_type: user_story_type,
        status: "success", // Set default status if needed
        created_at: doc.created_at || '',
        updated_at: doc.updated_at || '',
      };
    });

    return NextResponse.json({
      total: totalCount,
      skip: skip,
      limit: limit,
      data: processedData
    });

  } catch (error) {
    console.error('Error in artifacts POST route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}