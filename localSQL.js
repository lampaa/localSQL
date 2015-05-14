function localSQL(database, callback) {
	localSQL.func.open.prototype = localSQL.func;
	return new localSQL.func.open(database, callback);
};

localSQL.func = localSQL.prototype = {
	constructor: localSQL,
	//fs: require('fs'),
	regulars: {
		'queryMethod': /^(create\s+table|truncate\s+table|drop\s+table|select|insert\s+into|update|delete)\s+/i,
		'cutDataFromCreate': /^(:?\s+)?\((.*)\)(:?\s+)?$/,
		'cutDataFromAttribute':/\(\s*["']?(.*)['"]?\s*\)/,
		'cutDataFromInsert':/^(:?\s+)?(\((.*)\))(:?\s*)?values.*$/i,
		'parseAttributesOfValue':/\w+([\s]*\((.*?)\)(\s|$)|(\s|$))/g,
		'cutComlumnsFromSelect':/(.*?)\s+(from).*/i
	},
	dataTypes: {
		'int': {
			'size':[1, 22],
			'keys':['auto_increment', 'default', 'key']
		},
		'varchar': {
			'size':[1, 255],
			'keys':['default', 'key']		
		},
		'text': {
			'size':null,
			'keys':null
		},
		'datetime': {
			'size':null,
			'keys':['default']
		}
	},
	
	/**
	 * Open and load json database to memory
	 * @param {string} database
	 */
	open: function(database, callback) {
		var that = this;
		
		/**
		 * create database in memory
		 */
		if(database == ':memory') {
			this.DB = {};
			return callback.call(this);
		}
		
		/**
		 * check file
		 */
		fs.exists(database, function (exists) {
			if(exists) {
				callback.call(this);
			}
			else {
				throw new Error("File not found: " + database);
			}
		});
		
		return;
	},
	
	/**
	 * minimal query parser
	 */
	query: function(expression) {
		/**
		 * query type
		 */
		if(expression == undefined || typeof expression != 'string') {
			throw new Error("Query expression is not the correct format.");
		}
		
		var queryMethod = expression.match(this.regulars.queryMethod)
		,	queryStringPaste;
		
		if(queryMethod == null) {
			throw new Error("Query expression is not the correct format.");
		}
		
		queryMethod = queryMethod[1];
		queryStringPaste = this._trimLeft(expression.replace(queryMethod, ''));
		
		switch (queryMethod.toLowerCase().replace(' ', '', 'g')) {
			case 'createtable':
				this._createTable(queryStringPaste);
				break;
			case 'truncatetable':
				this._truncateTable(queryStringPaste);
				break;
			case 'droptable':
				this._dropTable(queryStringPaste);
				break;
			case 'insertinto':
				this._insertInto(queryStringPaste);
				break;
			case 'select':
				this._select(queryStringPaste);
				break;

			case 'update':
			
				break;
			case 'delete':
			
				break;
		}
		
		return this;
	},
	
	fetch: function(type) {
		
	}, 
	
	_createTable: function(expression) {
		// get table name
		var tableName = expression.split(' ')[0]; 
		// get array table values

		var tableData = this._parseExpressionVars(this._trim(expression.substring(expression.indexOf(' ')).replace(this.regulars.cutDataFromCreate, '$2')));
		

		// table length
		var tableLength = tableData.length;
		// check table length
		if(tableLength == 0) {
			throw new Error("Query expression has no parameters of table.");
		}
		
		// check table for exists
		if(this.DB[tableName] != undefined) {
			throw new Error("Create table already exists: " + tableName);
		}
		
		// create tmp data
		var tmp_data = {
			'model':	[],
			'indexes':	{},
			'data':		[]
		}
		
		
		
		// parse values
		for(var i=0, push = {}; i < tableLength; i++, push = {}) {
			tableData[i] = this._trimLeft(tableData[i]);
			
			var value_name = tableData[i].split(' ')[0].toLowerCase();
			var value_attributes = tableData[i].substring(value_name.length).match(this.regulars.parseAttributesOfValue);
			
			// get all types and attributes
			if(value_attributes == null) {
				throw new Error("Undefined type of value: " + value_name);
			}
			
			// get type name
			var type = this._trimRight(value_attributes[0].split('(')[0].toLowerCase());
			
			//console.log(tableData[i]);
			
			// check type name
			if(this.dataTypes[type] == undefined) {
				throw new Error("Unrecognized type '"+ type +"' of value: " + value_name);
			}
			
			// check value of type
			if(this.dataTypes[type]['size'] != null) {
				if(value_attributes[0] == undefined) {
					throw new Error("Unrecognized value of type '" + type +"' in value: " + value_name);
				}
				var type_value = parseInt(this._trim(value_attributes[0].match(this.regulars.cutDataFromAttribute)[1]));
				if(this.dataTypes[type]['size'][0] > type_value || this.dataTypes[type]['size'][1] < type_value) {
					throw new Error("Value of type '" + type +"' is invalid in value: " + value_name);
				}
			}
			
			push = {
				'name': value_name,
				'type': type,
				'size': type_value==undefined?null:type_value
			}
			
			// parse keys of type
			for(var k=1, key_name, key_value; k < value_attributes.length; k++) {
				key_name = this._trim(value_attributes[k].split('(')[0].toLowerCase());
				
				if(this.dataTypes[type]['keys'].indexOf(key_name) == -1) {
					throw new Error("Unrecognized key '"+ key_name +"' of type: " + type);
				}
				
				// check keys and keys values
				switch (key_name) {
					case 'auto_increment':
						push['auto_increment'] = true;
						break;
					case 'default':
						if(value_attributes[k] == undefined) {
							throw new Error("Null key '"+ key_name +"' of type: " + type);
						}
						push['default'] = this._trim(value_attributes[k].match(this.regulars.cutDataFromAttribute)[1]);
						break;
					case 'key':
						tmp_data['indexes'][value_name] = [];
						push['index'] = true;
						break;
				}
			}
			tmp_data['model'].push(push);
		}
		this.DB[tableName] = tmp_data;
		console.log(tmp_data);
		return true;
	},
	
	_insertInto: function(expression) {
		// get table name
		var tableName = expression.split(' ')[0];
		
		// check table
		if(this.DB[tableName] == undefined) {
			throw new Error("Table not exists: " + tableName);
		}
		
		// cut expression
		var cut_expression = this._trimLeft(expression.substring(tableName.length));
		
		// get expression type
		var first_expression = this._trimRight(cut_expression.split('(')[0]);
		
		// columns names
		for(var i=0, columns_names = [], model_length = this.DB[tableName]['model'].length; i < model_length; i++) {
			columns_names.push(this.DB[tableName]['model'][i].name);
		}

		var insert_to_values_names = [];
			
		// get expression names and values
		if(first_expression.toLowerCase() == 'values') {
			// puts models names
			insert_to_values_names = columns_names;
		}
		else {	
			// get names
			var insert_to_values_names_array = cut_expression.match(this.regulars.cutDataFromInsert);//[2];
			
			if(insert_to_values_names_array[3] == null || !insert_to_values_names_array[3]) {
				throw new Error("Undefined values name of query: " + expression);
			}
			// get values
			cut_expression = cut_expression.substring(insert_to_values_names_array[2].length);
			
			var insert_to_values_names_temp = insert_to_values_names_array[3].split(',');
			
			// check && complete names
			for(i=0, model_length = insert_to_values_names_temp.length; i < model_length; i++) {
				insert_to_values_names_temp[i] = this._trim(insert_to_values_names_temp[i]);
				
				if(columns_names.indexOf(insert_to_values_names_temp[i]) == -1) {
					throw new Error("Unrecognized column name '"+ insert_to_values_names_temp[i] +"' in table: " + tableName);
				}
				
				insert_to_values_names.push(insert_to_values_names_temp[i]);
			}
			
			first_expression = cut_expression.split('(')[0];
		}
		
		// values
		var parse_expression = this._trim(cut_expression.substring(first_expression.length).match(this.regulars.cutDataFromCreate)[2]);
		
		if(parse_expression == null || !parse_expression) {
			throw new Error("Undefined values of query: " + expression);
		}

		//
		var tokens = this._parseExpressionVars(parse_expression);
		
		//
		if(tokens.length != insert_to_values_names.length) {
			throw new Error("Non-compliance of the column names and values in query: "+ expression);
		}
		
		for(var condtion = {}, i=0; i < insert_to_values_names.length; i++) {
			condtion[insert_to_values_names[i]] = tokens[i];
		}

		//
		for(var i=0, model_length = columns_names.length, paste_to_data = [], paste_to_index = {}, token_value='', token_params; i < model_length; i++) { //new Date().getTime();
			if(condtion[columns_names[i]] == undefined) {
				token_value = this.DB[tableName]['model'][i]['default'];
				
				if(token_value == undefined) {
					throw new Error("Undefined default value of name: " + columns_names[i]);
				}
			}
			else {
				token_params = this.DB[tableName]['model'][i];
				
				switch(token_params['type']) {
					case 'int': 
						if(condtion[columns_names[i]].toLowerCase() === 'null') {
							if(!token_params['auto_increment']) {
								throw new Error("Null value of name: " + columns_names[i] +  ". Use auto_increment.");
							}
							
							token_value = this.DB[tableName]['data'].length;
						}
						else {
							token_value = condtion[columns_names[i]].substring(0, token_params['size']);
							token_value = parseInt(token_value);
						}
						
						if(token_params['index']) {
							if(this.DB[tableName]['indexes'][columns_names[i]][token_value] != undefined) {
								throw new Error("Index " + token_value + " of column "+ columns_names[i] +" already exists. Table: " + tableName);
							}
							
							this.DB[tableName]['indexes'][columns_names[i]][token_value] = this.DB[tableName]['data'].length;
						}
						break;
					case 'varchar':
						token_value = this._cutQuotes(condtion[columns_names[i]].substring(0, token_params['size']));
						
						if(token_params['index']) {
							if(this.DB[tableName]['indexes'][columns_names[i]][token_value] != undefined) {
								throw new Error("Index " + token_value + " of column "+ columns_names[i] +" already exists. Table: " + tableName);
							}
							
							this.DB[tableName]['indexes'][columns_names[i]][token_value] = this.DB[tableName]['data'].length;
						}
					break;
					case 'text':
						token_value = this._cutQuotes(condtion[columns_names[i]]);
						break;
					case 'datetime':
						if(condtion[columns_names[i]] == 'NOW()') {
							token_value = (new Date()).getTime()/1000;
						}
						else {
							token_value = parseInt(this._cutQuotes(condtion[columns_names[i]]).substring(0, 11));
						}
					break;
				}
			}
			paste_to_data.push(token_value);
		}
		this.DB[tableName]['data'].push(paste_to_data);
		return true;
	},
	
	/**
	 *
	 */
	_parseExpressionVars: function(parse_expression) {
		var len = parse_expression.length;
		var tokens = [];
		var compiler_tokens = {};
		var tags = ["'", '"', '(', ')'];
		var token = '';
		var ifOpenTokens;
				
		for(var pos = 0, last_cut = 0; pos < len; pos++, ifOpenTokens = false) {
			if(tags.indexOf(parse_expression[pos]) != -1) {
						
				if(!(parse_expression[pos-1] != undefined 
					&& parse_expression[pos-1] == '\\'  // если предыдущий символ - обратный слеш
					&& parse_expression[pos-2] != undefined
					&& parse_expression[pos-2] != '\\') 
					|| parse_expression[pos-1] != '\\'// если предыдущий символ - не слеш, то обрабатываем
				) {

					if(compiler_tokens[parse_expression[pos]] == undefined || !compiler_tokens[parse_expression[pos]]) {
						if((parse_expression[pos] == '(' || parse_expression[pos] == ')') 
							&& (compiler_tokens['"'] == undefined || !compiler_tokens['"'])  
							&& (compiler_tokens["'"] == undefined || !compiler_tokens["'"])
						) {
							compiler_tokens[parse_expression[pos]] = 1;
						}
						else if(parse_expression[pos] == '(' || parse_expression[pos] == ')') {
							continue;
						}
						else {
							compiler_tokens[parse_expression[pos]] = true;
						}
					}
					else {
						if((parse_expression[pos] == '(' || parse_expression[pos] == ')') 
							&& (compiler_tokens['"'] == undefined || !compiler_tokens['"'])
							&& (compiler_tokens["'"] == undefined || !compiler_tokens["'"])
						) {
							compiler_tokens[parse_expression[pos]]++;
						}
						else if(parse_expression[pos] == '(' || parse_expression[pos] == ')') {
							continue;
						}
						else {
							compiler_tokens[parse_expression[pos]] = false;
						}
					}
				}
			}
			
			if(parse_expression[pos] == ',') {
				// check for open tokens
				
				if(compiler_tokens['('] != compiler_tokens[')'] 
				&& (!compiler_tokens['"'] && !compiler_tokens["'"])) {
					throw new Error("Remained unclosed tags in query '"
						+ parse_expression.substring(last_cut, pos));
				}
				else {
					if(compiler_tokens['"'] || compiler_tokens["'"]) {
						ifOpenTokens = true;
					}	
				}
						
				if(!ifOpenTokens) {
					token = this._trim(parse_expression.substring(last_cut, pos));
					tokens.push(token);
				}
				last_cut += parse_expression.substring(last_cut, pos).length + 1;
			}
					
			if(pos == len - 1) {
				token = this._trim(parse_expression.substring(last_cut, pos + 1));
				tokens.push(token);
			}
		}

		if (compiler_tokens['"'] || compiler_tokens["'"]) {
			throw new Error("Remained unclosed tags in query '"+ parse_expression);
		}
		
		return tokens;
	},
	
	/**
	 *
	 */
	_truncateTable: function(expression) {
		// get table name
		var tableName = expression.split(' ')[0];
		
		// check table
		if(this.DB[tableName] == undefined) {
			throw new Error("Table not exists: " + tableName);
		}
		
		this.DB[tableName]['data'] = [];
		this.DB[tableName]['indexes'] = {};
		
		return true;
	},
	
	_dropTable: function(expression) {
		// get table name
		var tableName = expression.split(' ')[0];
		
		// check table
		if(this.DB[tableName] == undefined) {
			throw new Error("Table not exists: " + tableName);
		}
		
		delete this.DB[tableName];
		
		return true;	
	},
	
	_select: function(expression) {
		// match columns and tag FROM
		var matches = expression.match(this.regulars.cutComlumnsFromSelect);
		// get columns
		var columns = matches[1].split(',');
		
		console.log(columns);
		
	},
	
	_conditionParser: function(condition) {
		var len = condition.length;
		var pos = 0;
		
		for(var i=0; pos < len;i++) {
			
		}
		
		
		var columns = condition.split('');
	},
	
	_cutQuotes: function (string) {
		if(string[0] == "'" || string[0] == '"') {
			string = string.substring(1);
		}
						
		if(string[string.length-1] == "'" || string[string.length-1] == '"') {
			string = string.substring(0, string.length-1);
		}
		
		return string;
	},
	
	_trimLeft: function(string) {
		var start = -1;
		while(string.charCodeAt(++start) < 33);
		return string.slice(start, string.length + 1);	
	},
	
	_trimRight: function(string) {
		var end = string.length;
		while(string.charCodeAt(--end) < 33 );
		return string.slice(0, end + 1);
	},
	
	_trim: function (string) {
		return this._trimLeft(this._trimRight(string));
	},
	
	close: function() {
	
	}
}