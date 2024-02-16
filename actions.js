module.exports = function (self) {
	self.setActionDefinitions({
		'get_all_status': {
			name: 'Get Updated Status of Device',
            options: [],
            callback: async () => {
                self.sendCmd('< GET ALL >')
            }
		},
		'preset_recall': {
			name: 'Preset Recall',
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
			],
            callback: async ({options}) => {
                self.sendCmd(`< SET PRESET ${ options.preset } >`)
            }
		},
		'flash_lights': {
			name: 'Flash Lights on Device',
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
			],
            callback: async ({options}) => {
                self.sendCmd(`< SET FLASH ${ options.onoff } >`)
            }
		},
		'reboot': {
			name: 'Reboot the Device',
            options: [],
            callback: async () => {
                self.sendCmd('< SET REBOOT >')
            }
		}
	})
}