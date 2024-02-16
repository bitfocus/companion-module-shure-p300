const { combineRgb } = require('@companion-module/base')

module.exports = async function (self) {
	self.setFeedbackDefinitions({
		flash_state: {
			name: 'Flash State',
            description: 'If the device is flashing, change the button style.',
            type: 'boolean',
            defaultStyle: {
                color: 0xffffff,
                bgcolor: 0x66ff00
            },
            options: [],
            callback: (feedback) => {
                if (self.state['flash_state'] === 'ON') {
                    return true
                }
                return false
            }
        }, 
        preset_active: {
			name: 'Preset active',
            description: 'Change style if selected preset is active.',
            type: 'boolean',
            defaultStyle: {
                color: 0xffffff,
                bgcolor: 0x66ff00
            },
            options: [
                {
                    type: 'dropdown',
					label: 'Preset Number',
					id: 'preset',
					default: 1,
					choices: [
						{id: 1, label: 'Preset 1'},
						{id: 2, label: 'Preset 2'},
						{id: 3, label: 'Preset 3'},
						{id: 4, label: 'Preset 4'},
						{id: 5, label: 'Preset 5'},
						{id: 6, label: 'Preset 6'},
						{id: 7, label: 'Preset 7'},
						{id: 8, label: 'Preset 8'},
						{id: 9, label: 'Preset 9'},
						{id: 10, label: 'Preset 10'}
					]
                }
            ],
            callback: (feedback) => {
                if (self.state['preset_active'] == feedback.options.preset) {
                    return true
                }
                return false
            }
        }
	})
}