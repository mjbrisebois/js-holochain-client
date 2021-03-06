
const { TimeoutError }			= require('@whi/promise-timeout');
const HoloHashTypes			= require('@whi/holo-hash');
const { HoloHash }			= HoloHashTypes;

const { log,
	set_tostringtag }		= require('./utils.js');
const { ...ErrorTypes }			= require('./errors.js');
const { AppSchema, DnaSchema }		= require('./schemas.js');
const { Connection }			= require('./connection.js');
const { ZomeApi }			= require('./zome_api.js');
const { AdminClient }			= require('./admin_client.js');


const DEFAULT_AGENT_CLIENT_OPTIONS	= {
};

class AgentClient {

    static async createFromAppInfo ( app_id, connection, timeout, options = {} ) {
	const conn			= new Connection( connection );

	log.debug && log("Opening connection '%s' for AgentClient", conn.name );
	await conn.open();

	const app_schema		= {};
	const app_info			= await conn.request("app_info", {
	    "installed_app_id": app_id,
	}, timeout );

	let agent;

	for ( let cell of app_info.cell_data ) {
	    cell.cell_id[0]		= new HoloHashTypes.DnaHash(	 cell.cell_id[0] );
	    cell.cell_id[1]		= new HoloHashTypes.AgentPubKey( cell.cell_id[1] );

	    if ( agent === undefined )
		agent			= cell.cell_id[1];

	    app_schema[cell.role_id]	= cell.cell_id[0];
	}

	options.app_info		= app_info;

	log.debug && log("Creating AgentClient from app info for '%s' (%s): %s ", app_id, agent, Object.keys(app_schema).join(", ") );
	return new AgentClient( agent, app_schema, conn, options );
    }

    constructor ( agent, app_schema, connection, options ) {
	this._agent			= agent;
	this._app_schema		= app_schema instanceof AppSchema
	    ? app_schema
	    : new AppSchema( app_schema );

	if ( connection instanceof Connection )
	    this._conn			= connection;
	else
	    this._conn			= new Connection( connection );

	this._options			= Object.assign( {}, DEFAULT_AGENT_CLIENT_OPTIONS, options );

	this.app_info			= this._options.app_info || null;
	this.pre_processors		= [];
	this.post_processors		= [];
    }

    addProcessor ( event, callback ) {
	if ( event === "input" )
	    this.pre_processors.push( callback );
	else if ( event === "output" )
	    this.post_processors.push( callback );
	else
	    throw new Error(`Unknown processor event '${event}'; expected 'input' or 'output'`);
    }

    async _run_processors ( event, value, ctx ) {
	let processors;
	if ( event === "input" )
	    processors			= this.pre_processors;
	else if ( event === "output" )
	    processors			= this.post_processors;
	else
	    throw new Error(`Unknown processor event '${event}'; expected 'input' or 'output'`);

	for ( let fn of processors ) {
	    value			= await fn.call( ctx, value, ctx );
	}

	return value;
    }

    async call ( dna_role_id, zome, func, payload, timeout ) {
	if ( this._conn._opened === false ) {
	    log.debug && log("Opening connection '%s' for AgentClient", this._conn.name );
	    await this._conn.open();
	}

	const req_ctx			= {
	    "start": new Date(),
	    "end": null,
	    "dna": dna_role_id,
	    "zome": zome,
	    "func": func,
	    "input": payload,
	    "timeout": timeout,
	    duration () {
		return ( req_ctx.end || new Date() ) - req_ctx.start;
	    },
	};

	let dna_schema			= this._app_schema.dna( dna_role_id );
	let zome_api			= dna_schema.zome( zome );

	payload				= await this._run_processors( "input", payload, req_ctx );

	let result			= await zome_api.call(
	    this._conn,
	    this._agent,
	    dna_schema.hash(),
	    func,
	    payload,
	    timeout || this._options.timeout,
	);

	result				= await this._run_processors( "output", result, req_ctx );

	req_ctx.end			= new Date();

	return result;
    }

    async close ( timeout ) {
	return await this._conn.close( timeout );
    }
}
set_tostringtag( AgentClient, "AgentClient" );



module.exports = {
    Connection,

    AppSchema,
    DnaSchema,

    AdminClient,
    AgentClient,

    ZomeApi,

    ...ErrorTypes,
    TimeoutError,

    HoloHash,
    HoloHashTypes,

    logging () {
	log.debug			= true;
    },
};
