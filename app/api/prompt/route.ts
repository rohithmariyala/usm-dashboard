import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// Helper function to format metadata with timestamps
function formatMetadata(metadata: any = {}) {
  const now = new Date();
  return {
    ...metadata,
    displayDate: now.toISOString().split('T')[0], // YYYY-MM-DD
    displayTime: now.toTimeString().split(' ')[0], // HH:MM:SS
  };
}

// GET: Retrieve prompts with optional filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const flow = searchParams.get('flow');
    const feature = searchParams.get('feature');
    const mode = searchParams.get('mode');
    const type = searchParams.get('type');
    const version = searchParams.get('version');
    const promptId = searchParams.get('promptId');
    const env = searchParams.get('env') || 'dev';
    const latest = searchParams.get('latest') === 'true';

    const db = await getDatabase(env === 'prod' ? 'MONGODB_URI_PROD' : 'MONGODB_URI');
    const collection = db.collection('promptVersions');

    let query: any = {};

    // Build query based on parameters
    if (promptId) {
      query.promptId = promptId;
    } else {
      if (flow) query.flow = flow;
      if (feature) query.feature = feature;
      if (mode) query.mode = mode;
      if (type) query.type = type;
    }

    if (version && !latest) {
      query.version = parseInt(version);
      const result = await collection.findOne(query);
      if (!result) {
        return NextResponse.json(
          { error: 'Prompt not found' },
          { status: 404 }
        );
      }
      
      const responseObj = { ...result, _id: (result._id as any).toString() };
      return NextResponse.json(responseObj);
    }

    // If latest flag is set or no version specified, get the latest version
    let results;
    if (latest || (!version && (flow || feature || mode || type || promptId))) {
      results = await collection
        .find(query)
        .sort({ version: -1 })
        .limit(1)
        .toArray();
      
      if (results.length === 0) {
        return NextResponse.json(
          { error: 'Prompt not found' },
          { status: 404 }
        );
      }
      
      const first = { ...results[0], _id: (results[0]._id as any).toString() };
      return NextResponse.json(first);
    }

    // Get all prompts matching query (for listing purposes)
    results = await collection
      .find(query)
      .sort({ flow: 1, feature: 1, mode: 1, type: 1, version: -1 })
      .toArray();

    results = results.map((r: any) => ({ ...r, _id: (r._id as any).toString() }));

    return NextResponse.json({
      total: results.length,
      data: results
    });

  } catch (error) {
    console.error('Error in prompts GET route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Create new prompt version
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { env = 'dev' } = body;

    // Required fields validation
    const requiredFields = ['promptId', 'flow', 'feature', 'mode', 'type', 'prompt'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 }
        );
      }
    }

    const db = await getDatabase(env === 'prod' ? 'MONGODB_URI_PROD' : 'MONGODB_URI');
    const collection = db.collection('promptVersions');

    // Get latest version for this promptId
    const latest = await collection
      .findOne(
        { promptId: body.promptId },
        { sort: { version: -1 } }
      );

    const newVersion = latest ? latest.version + 1 : 1;

    // Prepare the new document
    const newDoc = {
      promptId: body.promptId,
      flow: body.flow,
      feature: body.feature,
      mode: body.mode,
      type: body.type,
      version: newVersion,
      prompt: body.prompt,
      metadata: formatMetadata(body.metadata),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await collection.insertOne(newDoc);
    
    return NextResponse.json({
      message: 'Prompt version created successfully',
      data: {
        ...newDoc,
        _id: result.insertedId.toString()
      }
    });

  } catch (error) {
    console.error('Error in prompts POST route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT: Update prompt (creates new version)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { env = 'dev' } = body;

    if (!body.promptId || !body.prompt) {
      return NextResponse.json(
        { error: 'promptId and prompt are required' },
        { status: 400 }
      );
    }

    const db = await getDatabase(env === 'prod' ? 'MONGODB_URI_PROD' : 'MONGODB_URI');
    const collection = db.collection('promptVersions');

    // Find the latest version
    const latest = await collection
      .findOne(
        { promptId: body.promptId },
        { sort: { version: -1 } }
      );

    if (!latest) {
      return NextResponse.json(
        { error: 'Prompt ID not found' },
        { status: 404 }
      );
    }

    const newVersion = latest.version + 1;

    // Build new version document
    const newDoc = {
      promptId: latest.promptId,
      flow: latest.flow,
      feature: latest.feature,
      mode: latest.mode,
      type: latest.type,
      version: newVersion,
      prompt: body.prompt,
      metadata: formatMetadata(body.metadata || latest.metadata),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await collection.insertOne(newDoc);

    return NextResponse.json({
      message: 'New prompt version created successfully',
      data: {
        ...newDoc,
        _id: result.insertedId.toString()
      }
    });

  } catch (error) {
    console.error('Error in prompts PUT route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: Delete specific prompt version
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const promptId = searchParams.get('promptId');
    const version = searchParams.get('version');
    const env = searchParams.get('env') || 'dev';

    if (!promptId || !version) {
      return NextResponse.json(
        { error: 'promptId and version are required' },
        { status: 400 }
      );
    }

    const db = await getDatabase(env === 'prod' ? 'MONGODB_URI_PROD' : 'MONGODB_URI');
    const collection = db.collection('promptVersions');

    const result = await collection.deleteOne({
      promptId,
      version: parseInt(version)
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Prompt version not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Prompt version deleted successfully'
    });

  } catch (error) {
    console.error('Error in prompts DELETE route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}