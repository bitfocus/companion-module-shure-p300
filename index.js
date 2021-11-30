// Shure P300
var tcp = require('../../tcp');
var instance_skel = require('../../instance_skel');
var debug;
var log;

function instance(system, id, config) {
	var self = this;

	// super-constructor
	instance_skel.apply(this, arguments);

	self.actions(); // export actions

	return self;
}

instance.prototype.localVariables = []; //instance access of variable data for feedback and other purposes

instance.prototype.init = function () {
	var self = this;

	debug = self.debug;
	log = self.log;

	self.status(self.STATUS_OK);

	self.init_variables();
	self.init_module();
	self.init_feedbacks();
};

instance.prototype.updateConfig = function (config) {
	var self = this;
	self.config = config;

	self.status(self.STATUS_OK);

	self.init_variables();
	self.init_module();
	self.init_feedbacks();
};

//init_module: establishes connection and polls the Shure receiver for all the initial information
instance.prototype.init_module = function () {
	var self = this;
	
	var receivebuffer = '';

	if (self.socket !== undefined) {
		self.socket.destroy();
		delete self.socket;
	}

	if (self.config.port === undefined) {
		self.config.port = 2202;
	}

	if (self.config.host) {
		self.socket = new tcp(self.config.host, self.config.port);

		self.socket.on('status_change', (status, message) => {
			self.status(status, message);
		});

		self.socket.on('error', (err) => {
			debug("Network error", err);
			self.log('error',"Network error: " + err.message);
		});

		self.socket.on('connect', () => {
			debug("Connected");
			let cmd = '< GET 0 ALL >';
			self.socket.send(cmd);
			self.updateVariable('last_command_sent', cmd);
			self.actions(); // export actions
		});
	
		// separate buffered stream into lines with responses
		self.socket.on('data', (chunk) => {
			var i = 0, line = '', offset = 0;
			receivebuffer += chunk;

			while ( (i = receivebuffer.indexOf('>', offset)) !== -1) {
				line = receivebuffer.substr(offset, i - offset);
				offset = i + 1;
				self.socket.emit('receiveline', line.toString());
			}

			receivebuffer = receivebuffer.substr(offset);
		});

		self.socket.on('receiveline', (line) => {
			self.processShureCommand(line.replace('< ','').trim());
		});
	}
};

instance.prototype.processShureCommand = function (command) {
	var self = this;
	
	self.updateVariable('last_command_received', command);
	
	let commandArr = null;
	let commandNum = null;
	let commandVar = null;
	let commandVal = null;

	try {
		if (command.substr(0, 3) === 'REP') {
			//this is a report command
			let channelNumber = parseInt(command.substr(4,1));
			
			if (isNaN(channelNumber)) {
				//this command isn't about a specific channel
				commandArr = command.split(' ');
				commandVar = commandArr[1];
				commandVal = commandArr[2];
			}
			else {
				//this command IS about a specific channel
				commandArr = command.split(' ');
				commandNum = commandArr[1];
				commandVar = commandArr[2];
				commandVal = commandArr[3];
			}
			
			switch(commandVar) {
				case 'MODEL':
					self.updateVariable('model', commandVal.trim());
					break;
				case 'SERIAL_NUM':
					self.updateVariable('serial_number', commandVal.trim());
					break;
				case 'FW_VER':
					self.updateVariable('firmware_version', commandVal);
					break;
				case 'DEVICE_ID':
					self.updateVariable('deviceid', commandVal.trim());
					break;
				case 'CHAN_NAME':
					self.updateVariable('channel_name_' + commandNum, commandVal.trim());
					self.actions();
					self.init_feedbacks();
					break;
				case 'FLASH':
					self.updateVariable('flash_state', commandVal);
					self.checkFeedbacks('flash_state');
					break;
				case 'PRESET':
					self.updateVariable('preset_active', commandVal);
					break;
				default:
					break;
			}
		}
	}
	catch(error) {
		self.log('error', 'Unexpected error processing message from device: ' + error);
	}
};

// Return config fields for web config
instance.prototype.config_fields = function () {
	var self = this;

	return [
		{
			type: 'textinput',
			id: 'host',
			label: 'Target IP',
			width: 6,
			regex: self.REGEX_IP
		},
		{
			type: 'textinput',
			id: 'port',
			label: 'Target Port',
			default: 2202,
			width: 4,
			regex: self.REGEX_PORT
		}
	]
};

// When module gets deleted
instance.prototype.destroy = function () {
	var self = this;

	debug('destroy', self.id);
};

//init_variables: establish instance dynamic variables for button display and other purposes
instance.prototype.init_variables = function() {
	var self = this;

	var variables = [];
	
	var channelCount = 4;
	
	for (let i = 1; i <= channelCount; i++) {
		variables.push({ name: 'channel_name_' + i, label: 'Channel ' + i + ' Name' });
		variables.push({ name: 'channel_mute' + i, label: 'Channel ' + i + ' Mute' });
	}

	for (let i = 1; i <= 10; i++) {
		variables.push({ name: 'preset_name_' + i, label: 'Preset ' + i + ' Name' });;
	}
	
	variables.push({ name: 'model', label: 'Model' });
	variables.push({ name: 'serial_number', label: 'Serial Number' });
	variables.push({ name: 'firmware_version', label: 'Firmware Version' });
	variables.push({ name: 'deviceid', label: 'Device ID' });
	variables.push({ name: 'flash_state', label: 'Flash State' });
		
	variables.push({ name: 'last_command_sent',	label: 'Last Command Sent' });
	variables.push({ name: 'last_command_received',	label: 'Last Command Received' });

	self.setVariableDefinitions(variables);
	self.localVariables = variables; //copies variable definitions for local instance use
};

//updateVariable: updates both the system instance variable and local variable for button display and feedback purposes
instance.prototype.updateVariable = function (variableName, value) {
	var self = this;
	
	self.setVariable(variableName, value);
	self.localVariables[variableName] = value;
};

instance.prototype.actions = function (system) {
	var self = this;
	
	var channelList = [];
	
	var channelCount = 4;
	
	for (let i = 1; i <= channelCount; i++) {
		let channelListObj = {};
		channelListObj.id = i;
		channelListObj.label = 'Channel ' + i;
		channelListObj.label += ' (' + self.localVariables['channel_name_' + i] + ')';
		channelList.push(channelListObj);
	}

	self.system.emit('instance_actions', self.id, {
		'get_all_status': {
			label: 'Get Updated Status of Device'
		},
		'preset_recall': {
			label: 'Preset Recall',
			options: [
				{
					type: 'dropdown',
					label: 'Preset Number',
					id: 'preset',
					default: '1',
					choices: [
						{id: '1', label: 'Preset 1'},
						{id: '2', label: 'Preset 2'},
						{id: '3', label: 'Preset 3'},
						{id: '4', label: 'Preset 4'},
						{id: '5', label: 'Preset 5'},
						{id: '6', label: 'Preset 6'},
						{id: '7', label: 'Preset 7'},
						{id: '8', label: 'Preset 8'},
						{id: '9', label: 'Preset 9'},
						{id: '10', label: 'Preset 10'}
					]
				}
			]
		},
		'flash_lights': {
			label: 'Flash Lights on Device',
			options: [
				{
					type: 'dropdown',
					label: 'On/Off',
					id: 'onoff',
					default: 'ON',
					choices: [
						{id: 'OFF', label: 'Off'},
						{id: 'ON', label: 'On'}
					]
				}
			]
		},
		'reboot': {
			label: 'Reboot the Device'
		}
	});
};

instance.prototype.action = function (action) {
	var self = this;
	var options = action.options;
	
	var cmd;

	switch (action.action) {
		case 'get_all_status':
			cmd = '< GET ALL >';
			break;
		case 'preset_recall':
			cmd = '< SET PRESET ' + options.preset + ' >';
			break;
		case 'flash_lights':
			cmd = '< SET FLASH ' + options.onoff + ' >';
			break;
		case 'reboot':
			cmd = '< SET REBOOT >';
			break;
		default:
			break;
	}
	
	if (cmd !== undefined) {
		if (self.socket !== undefined && self.socket.connected) {
			self.socket.send(cmd);
			self.updateVariable('last_command_sent', cmd);
		} else {
			debug('Socket not connected :(');
		}
	}
};

instance.prototype.init_feedbacks = function() {
	var self = this;

	var feedbacks = {};
	
	var channelList = [];
	
	var channelCount = 4;
	
	for (let i = 1; i <= channelCount; i++) {
		let channelListObj = {};
		channelListObj.id = i;
		channelListObj.label = 'Channel ' + i;
		channelListObj.label += ' (' + self.localVariables['channel_name_' + i] + ')';
		channelList.push(channelListObj);
	}

	feedbacks['flash_state'] = {
		label: 'Flash State',
		description: 'If the device is flashing, change the color of the button.',
		options: [
			{
				type: 'colorpicker',
				label: 'Foreground color',
				id: 'fg',
				default: self.rgb(255,255,255)
			},
			{
				type: 'colorpicker',
				label: 'Background color',
				id: 'bg',
				default: self.rgb(100,255,0)
			}
		],
		callback: (feedback, bank) => {
			if (self.localVariables['flash_state'] === 'ON') {
				return {
					color: feedback.options.fg,
					bgcolor: feedback.options.bg
				};
			}
		}
	};

	self.setFeedbackDefinitions(feedbacks);
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;