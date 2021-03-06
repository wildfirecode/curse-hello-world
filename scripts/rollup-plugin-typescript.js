'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var path = require('path');
var fs = require('fs');
var ts = require('typescript');
var rollupPluginUtils = require('rollup-pluginutils');
var resolveId = _interopDefault(require('resolve'));

function endsWith ( str, tail ) {
	return !tail.length || str.slice( -tail.length ) === tail;
}

function getDefaultOptions () {
	return {
		noEmitHelpers: true,
		module: 'ESNext',
		sourceMap: true,
		importHelpers: true
	};
}

// Gratefully lifted from 'look-up', due to problems using it directly:
//   https://github.com/jonschlinkert/look-up/blob/master/index.js
//   MIT Licenced
function findFile ( cwd, filename ) {
	var fp = cwd ? ( cwd + '/' + filename ) : filename;

	if ( fs.existsSync( fp ) ) {
		return fp;
	}

	var segs = cwd.split( path.sep );
	var len = segs.length;

	while ( len-- ) {
		cwd = segs.slice( 0, len ).join( '/' );
		fp = cwd + '/' + filename;
		if ( fs.existsSync( fp ) ) {
			return fp;
		}
	}

	return null;
}

function getConfigContent(path){
	var content = fs.readFileSync( path, 'utf8' );
	/*if(process.env.hasOwnProperty('GAME_LIB_PATH')){
		content = content.replace('$GAME_LIB_PATH$', process.env.GAME_LIB_PATH)
	}*/

	return content;
}

function getCompilerOptionsFromTsConfig (typescript, tsconfigPath) {
	if (tsconfigPath && !fs.existsSync(tsconfigPath)) {
		throw new Error(("Could not find specified tsconfig.json at " + tsconfigPath));
	}
	var existingTsConfig = tsconfigPath || findFile( process.cwd(), 'tsconfig.json' );
	if (!existingTsConfig) {
		return {};
	}
	var tsconfig = typescript.readConfigFile( existingTsConfig, getConfigContent);

	if ( !tsconfig.config || !tsconfig.config.compilerOptions ) { return {}; }
	return tsconfig.config.compilerOptions;
}

function adjustCompilerOptions ( typescript, options ) {
	// Set `sourceMap` to `inlineSourceMap` if it's a boolean
	// under the assumption that both are never specified simultaneously.
	if ( typeof options.inlineSourceMap === 'boolean' ) {
		options.sourceMap = options.inlineSourceMap;
		delete options.inlineSourceMap;
	}

	// Delete the `declaration` option to prevent compilation error.
	// See: https://github.com/rollup/rollup-plugin-typescript/issues/45
	delete options.declaration;
}

var resolveHost = {
	directoryExists: function directoryExists ( dirPath ) {
		try {
			return fs.statSync( dirPath ).isDirectory();
		} catch ( err ) {
			return false;
		}
	},
	fileExists: function fileExists ( filePath ) {
		try {
			return fs.statSync( filePath ).isFile();
		} catch ( err ) {
			return false;
		}
	}
};

var TSLIB_ID = '\0tslib';

function typescript ( options ) {
	if ( options === void 0 ) options = {};

	options = Object.assign( {}, options );

	var filter = rollupPluginUtils.createFilter(
		options.include || [ '*.ts+(|x)', '**/*.ts+(|x)' ],
		options.exclude || [ '*.d.ts', '**/*.d.ts' ] );

	delete options.include;
	delete options.exclude;

	// Allow users to override the TypeScript version used for transpilation and tslib version used for helpers.
	var typescript = options.typescript || ts;
	var tslib = options.tslib ||
		fs.readFileSync(resolveId.sync('tslib/tslib.es6.js', { basedir: __dirname }), 'utf-8' );

	delete options.typescript;
	delete options.tslib;

	// Load options from `tsconfig.json` unless explicitly asked not to.
	var tsconfig = options.tsconfig === false ?
		{} :
		getCompilerOptionsFromTsConfig( typescript, options.tsconfig );

	delete options.tsconfig;

	// Since the CompilerOptions aren't designed for the Rollup
	// use case, we'll adjust them for use with Rollup.
	adjustCompilerOptions( typescript, tsconfig );
	adjustCompilerOptions( typescript, options );

	options = Object.assign( tsconfig, getDefaultOptions(), options );

	// Verify that we're targeting ES2015 modules.
	var moduleType = options.module.toUpperCase();
	if ( moduleType !== 'ES2015' && moduleType !== 'ES6' && moduleType !== 'ESNEXT' && moduleType !== 'COMMONJS' ) {
		throw new Error( ("rollup-plugin-typescript: The module kind should be 'ES2015' or 'ESNext, found: '" + (options.module) + "'") );
	}

	var parsed = typescript.convertCompilerOptionsFromJson( options, process.cwd() );

	if ( parsed.errors.length ) {
		parsed.errors.forEach( function (error) { return console.error( ("rollup-plugin-typescript: " + (error.messageText)) ); } );

		throw new Error( "rollup-plugin-typescript: Couldn't process compiler options" );
	}

	var compilerOptions = parsed.options;

	return {
		name: 'typescript',

		resolveId: function resolveId$$1 ( importee, importer ) {
			if ( importee === 'tslib' ) {
				return TSLIB_ID;
			}

			if ( !importer ) { return null; }
			importer = importer.split('\\').join('/');

			var result = typescript.nodeModuleNameResolver(importee, importer, compilerOptions, resolveHost);

			if ( result.resolvedModule && result.resolvedModule.resolvedFileName ) {
				if ( endsWith( result.resolvedModule.resolvedFileName, '.d.ts' ) ) {
					return null;
				}

				return result.resolvedModule.resolvedFileName;
			}

			return null;
		},

		load: function load ( id ) {
			if ( id === TSLIB_ID ) {
				return tslib;
			}
		},

		transform: function transform ( code, id ) {
			//if ( !filter( id ) ) { return null; }

			var transformed = typescript.transpileModule( code, {
				fileName: id,
				reportDiagnostics: true,
				compilerOptions: compilerOptions
			});

			// All errors except `Cannot compile modules into 'es6' when targeting 'ES5' or lower.`
			var diagnostics = transformed.diagnostics ?
				transformed.diagnostics.filter( function (diagnostic) { return diagnostic.code !== 1204; } ) : [];

			var fatalError = false;

			diagnostics.forEach( function (diagnostic) {
				var message = typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n');

				if ( diagnostic.file ) {
					var ref = diagnostic.file.getLineAndCharacterOfPosition( diagnostic.start );
					var line = ref.line;
					var character = ref.character;

					console.error( ((diagnostic.file.fileName) + "(" + (line + 1) + "," + (character + 1) + "): error TS" + (diagnostic.code) + ": " + message) );
				} else {
					console.error( ("Error: " + message) );
				}

				if ( diagnostic.category === ts.DiagnosticCategory.Error ) {
					fatalError = true;
				}
			});

			if ( fatalError ) {
				throw new Error( "There were TypeScript errors transpiling" );
			}

			return {
				code: transformed.outputText,

				// Rollup expects `map` to be an object so we must parse the string
				map: transformed.sourceMapText ? JSON.parse(transformed.sourceMapText) : null
			};
		}
	};
}

module.exports = typescript;
