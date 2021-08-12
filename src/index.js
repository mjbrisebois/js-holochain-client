
const { TimeoutError }			= require('@whi/promise-timeout');
const { HoloHash,
	HeaderHash,
	EntryHash,
	AgentPubKey,
	DnaHash,
	base64 }			= require('@whi/holo-hash');

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
    constructor ( agent, app_schema, ...args ) {
	this._options			= Object.assign( {}, DEFAULT_AGENT_CLIENT_OPTIONS );
	this._agent			= agent;
	this._app_schema		= app_schema instanceof AppSchema
	    ? app_schema
	    : new AppSchema( app_schema );

	if ( args[0] instanceof Connection ) {
	    let [ conn, opts ] = args;
	    this._conn			= conn;

	    Object.assign( this._options, opts );
	}
	else if ( typeof args[0] === "number" ) {
	    let [ port, host, opts ] = args;
	    this._conn			= new Connection( port, host );

	    Object.assign( this._options, opts );
	}
	else {
	    throw new TypeError(`Invalid arguments for AgentClient: ${ args.map(a => typeof a) }`)
	}
    }

    async call ( dna_nickname, zome, func, payload, timeout ) {
	if ( this._conn._opened === false ) {
	    log.debug && log("Opening connection '%s' for AgentClient", this._conn.name );
	    await this._conn.open();
	}

	let dna_schema			= this._app_schema.dna( dna_nickname );
	let zome_api			= dna_schema.zome( zome );

	return await zome_api.call(
	    this._conn,
	    this._agent,
	    dna_schema.hash(),
	    func,
	    payload,
	    timeout || this._options.timeout,
	);
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

    logging () {
	log.debug			= true;
    },
};
