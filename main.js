const { InstanceBase, Regex, runEntrypoint, InstanceStatus, TCPHelper } = require('@companion-module/base')
const UpgradeScripts = require('./upgrades')
const UpdateActions = require('./actions')
const UpdateFeedbacks = require('./feedbacks')
const UpdateVariableDefinitions = require('./variables')

class P300Instance extends InstanceBase {
	constructor(internal) {
		super(internal)
	}

	async init(config) {
		this.config = config
		this.state = {}
		this.receivebuffer = ''
		this.channelcount = 8

		this.updateStatus(InstanceStatus.Ok)

		this.updateActions() // export actions
		this.updateFeedbacks() // export feedbacks
		this.updateVariableDefinitions() // export variable definitions

		this.connect()
	}

	connect() {
		let self = this
		if (!this.config.host || !this.config.port) {
			this.updateStatus(InstanceStatus.BadConfig)
			this.log('warn', 'Uncomplete host or port in connection configuration')
			return
		}

		this.disconnect()
		this.updateStatus(InstanceStatus.Connecting)
		this.log('debug', 'trying to connect to ' + this.config.host + ':' + this.config.port)

		this.socket = new TCPHelper(this.config.host, this.config.port)

		this.socket.on('status_change', (status, message) => {
			self.updateStatus(status, message)
		})

		this.socket.on('error', (err) => {
			self.log('debug', "Network error: " + err.message)
		})

		this.socket.on('connect', () => {
			self.log('debug', "Connected")
			self.sendCmd('< GET 0 ALL >');
			//self.actions(); // export actions
		})

		// separate buffered stream into lines with responses
		this.socket.on('data', (chunk) => {
			let i = 0, line = '', offset = 0
			// self.log('debug', 'Receive chunk: '+ chunk)
			self.receivebuffer += chunk

			if (self.receivebuffer.length > 128_000) {
				self.receivebuffer = ''
				self.log('error', 'Receive buffer overflow. Flushing.')
				return
			}

			let start = self.receivebuffer.indexOf('<')
			let end = self.receivebuffer.indexOf('>')

			if (start == -1) return // no valid reply has been started
			if (end == -1) return // no valid reply has been ended
			if (end < start) { // there is a fragment at start of buffer
				self.receivebuffer = self.receivebuffer.slice(start) // remove fragment
			}

			while ( (i = self.receivebuffer.indexOf('>')) !== -1) {
				line = self.receivebuffer.substring(1, i - 1)
				self.receivebuffer = self.receivebuffer.slice(i+1)
				self.socket.emit('receiveline', line.toString())
			}

		})

		this.socket.on('receiveline', (line) => {
			self.processShureCommand(line.trim())
		})

	}

	disconnect() {
		if (this.socket !== undefined) {
			this.socket.destroy()
			delete this.socket
		}
	}

	processShureCommand(command) {
		let self = this
		
		this.updateVariable('last_command_received', command)
		
		let commandArr = null
		let commandNum = null
		let commandVar = null
		let commandVal = null
	
		try {
			if (command.substring(0, 3) === 'REP') {
				//this is a report command
				let channelNumber = parseInt(command.substr(4,2))
				let match = ''
				
				commandArr = command.split(' ')			
				if (isNaN(channelNumber)) {
					//this command isn't about a specific channel

					try {
						[match, commandVar, commandVal] = command.match(/^REP ([A-Z_]+) (.+)$/)
					} catch (error) {
						return
					}
				}
				else {
					//this command IS about a specific channel
					try {
						[match, commandNum, commandVar, commandVal] = command.match(/^REP (\d+) ([A-Z_]+) (.+)$/)
					} catch (error) {
						return
					}
				}
				
				switch(commandVar) {
					case 'MODEL':
						this.updateVariable('model', this.trimShureString(commandVal))
						break;
					case 'SERIAL_NUM':
						this.updateVariable('serial_number', this.trimShureString(commandVal))
						break;
					case 'FW_VER':
						this.updateVariable('firmware_version', this.trimShureString(commandVal))
						break;
					case 'DEVICE_ID':
						this.updateVariable('deviceid', this.trimShureString(commandVal))
						break;
					case 'CHAN_NAME':
						self.updateVariable('channel_name_' + channelNumber, this.trimShureString(commandVal))
						break;
					case 'AUDIO_MUTE':
						self.updateVariable('channel_mute_' + channelNumber, commandVal)
						break;
					case 'FLASH':
						this.updateVariable('flash_state', commandVal)
						self.checkFeedbacks('flash_state')
						break;
					case 'PRESET':
						this.updateVariable('preset_active', parseInt(commandVal))
						self.checkFeedbacks('preset_active')
						break;
					default:
						//self.log('debug', 'Unhandeled message from device: ' + command)
						break;
				}
			}
		}
		catch(error) {
			self.log('error', `Unexpected error processing message "${command}" from device:\n${error.trace}`)
		}
	}

	// When module gets deleted
	async destroy() {
		this.disconnect()
		this.log('debug', 'destroy')
	}

	async configUpdated(config) {
		let oldconfig = this.config
		this.config = config
		if (config.host !== oldconfig.host || config.port !== oldconfig.port) {
			this.disconnect()
			this.connect()
		}
	}

	// Return config fields for web config
	getConfigFields() {
		return [
			{
				type: 'textinput',
				id: 'host',
				label: 'Target IP',
				width: 8,
				regex: Regex.IP,
			},
			{
				type: 'textinput',
				id: 'port',
				label: 'Target Port',
				width: 4,
				default: '2202',
				regex: Regex.PORT,
			},
		]
	}

	updateActions() {
		UpdateActions(this)
	}

	updateFeedbacks() {
		UpdateFeedbacks(this)
	}

	updateVariableDefinitions() {
		UpdateVariableDefinitions(this)
	}

	//updateVariable: updates both the system instance variable and local variable for button display and feedback purposes
	updateVariable(variableName, value) {
		// this.log('debug', 'updating variable ' + variableName + ' to '+ value)
		this.setVariableValues({[variableName]: value})
		this.state[variableName] = value
	}

	trimShureString(string) {
		return string.replace(/^\{(.+?)\s*\}$/, "$1")
	}

	sendCmd(cmd) {
		if (!cmd) return

		if (this.socket && this.socket.isConnected) {
			try {
				this.socket.send(cmd)
			} catch (error) {
				this.updateStatus(InstanceStatus.ConnectionFailure)
				this.log('error', 'Sending command failed')
			}
			this.updateVariable('last_command_sent', cmd)
		} else {
			this.updateStatus(InstanceStatus.ConnectionFailure)
			this.log('error', 'Socket not connected')
		}
	}
}

runEntrypoint(P300Instance, UpgradeScripts)
