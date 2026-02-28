import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

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

    const granularityUnit = searchParams.get('granularityUnit') || 'day';
    const granularityBin = parseInt(searchParams.get('granularityBin') || '1', 10);
    const userType = searchParams.get('userType') || 'all';
    const internalEmailsParam = searchParams.get('internalEmails');
    const internalEmails: string[] = internalEmailsParam ? JSON.parse(internalEmailsParam) : [];

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

    const db = await getDatabase(envParam === 'prod' ? 'MONGODB_URI_PROD' : 'MONGODB_URI');
    const collection = db.collection('artifacts');

    // Date parsing stages reused from main pipeline
    const dateParseStages = [
      {
        $match: {
          created_at: { $exists: true, $nin: [null, ''] }
        }
      },
      {
        $addFields: {
          parsed_date: {
            $dateFromString: {
              dateString: {
                $concat: [
                  '20',
                  { $substr: [{ $substr: ['$created_at', 6, 2] }, 0, 2] },
                  '-',
                  { $substr: [{ $substr: ['$created_at', 3, 2] }, 0, 2] },
                  '-',
                  { $substr: ['$created_at', 0, 2] },
                  'T',
                  { $substr: [{ $substr: ['$created_at', 9, 8] }, 0, 8] },
                  'Z'
                ]
              },
              format: '%Y-%m-%dT%H:%M:%SZ',
              onError: null,
              onNull: null
            }
          }
        }
      },
      {
        $match: {
          parsed_date: {
            $ne: null,
            ...(fromTime ? { $gte: fromTime } : {}),
            $lte: toTime
          }
        }
      }
    ];

    // Exclude "Generated Overview Plan" sub-steps from analytics
    const excludeOverviewPlan = {
      $match: { artifactTitle: { $not: /^Generated Overview Plan/i } }
    };
    // Include only "Generated Overview Plan" sub-steps
    const onlyOverviewPlan = {
      $match: { artifactTitle: /^Generated Overview Plan/i }
    };

    // Build optional user type filter stage
    const userEmailStages: any[] = [];
    if (userType === 'internal' && internalEmails.length > 0) {
      userEmailStages.push({ $match: { userEmail: { $in: internalEmails } } });
    } else if (userType === 'actual' && internalEmails.length > 0) {
      userEmailStages.push({ $match: { userEmail: { $nin: internalEmails } } });
    }

    const pipeline: any[] = [
      ...dateParseStages,
      ...userEmailStages,
      {
        $facet: {
          // Summary counts — excludes Generated Overview Plan sub-steps
          summary: [
            excludeOverviewPlan,
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                success: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
                failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
                pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
                unique_users: { $addToSet: '$userEmail' },
                unique_templates: { $addToSet: '$modeName' }
              }
            }
          ],
          // Count per day — excludes Generated Overview Plan sub-steps
          by_day: [
            excludeOverviewPlan,
            {
              $addFields: {
                day: { $dateToString: { format: '%Y-%m-%d', date: '$parsed_date' } }
              }
            },
            { $group: { _id: '$day', count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, date: '$_id', count: 1 } }
          ],
          // Count per user with templates and last active — excludes Generated Overview Plan sub-steps
          by_user: [
            excludeOverviewPlan,
            {
              $group: {
                _id: '$userEmail',
                count: { $sum: 1 },
                templates: { $addToSet: '$modeName' },
                last_active: { $max: '$parsed_date' }
              }
            },
            { $sort: { count: -1 } },
            {
              $project: {
                _id: 0,
                email: '$_id',
                count: 1,
                templates: 1,
                last_active: { $dateToString: { format: '%Y-%m-%d', date: '$last_active' } }
              }
            }
          ],
          // Count per time bucket (granularity-aware) — excludes Generated Overview Plan sub-steps
          by_time: [
            excludeOverviewPlan,
            {
              $addFields: {
                bucket_date: {
                  $dateTrunc: {
                    date: '$parsed_date',
                    unit: granularityUnit,
                    binSize: granularityBin
                  }
                }
              }
            },
            { $group: { _id: '$bucket_date', count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
            {
              $project: {
                _id: 0,
                bucket: { $dateToString: { format: '%Y-%m-%dT%H:%M:%SZ', date: '$_id' } },
                count: 1
              }
            }
          ],
          // Count of Generated Overview Plan sub-steps (separate)
          overview_plan: [
            onlyOverviewPlan,
            { $count: 'count' }
          ]
        }
      }
    ];

    const [result] = await collection.aggregate(pipeline).toArray();

    const rawSummary = result?.summary?.[0];
    const summary = {
      total: rawSummary?.total ?? 0,
      // All documents returned are treated as success (status is not stored on documents)
      success: rawSummary?.total ?? 0,
      failed: rawSummary?.failed ?? 0,
      pending: rawSummary?.pending ?? 0,
      unique_users: (rawSummary?.unique_users ?? []).filter(Boolean).length,
      unique_templates: (rawSummary?.unique_templates ?? []).filter(Boolean).length
    };

    const overviewPlanCount = result?.overview_plan?.[0]?.count ?? 0;

    return NextResponse.json({
      summary: { ...summary, overview_plan_count: overviewPlanCount },
      by_day: result?.by_day ?? [],
      by_time: result?.by_time ?? [],
      by_user: (result?.by_user ?? []).filter((u: any) => u.email)
    });

  } catch (error) {
    console.error('Error in artifacts stats API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
