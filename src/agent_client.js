
const { log,
	set_tostringtag }		= require('./utils.js');
const { AppSchema, DnaSchema }		= require('./schemas.js');
const { Connection }			= require('./connection.js');


const DEFAULT_AGENT_CLIENT_OPTIONS	= {
};

class AgentClient {
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
    AgentClient,
};