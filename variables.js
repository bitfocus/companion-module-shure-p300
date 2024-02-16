module.exports = async function (self) {

    let variableDefinitions = [
        { variableId: 'model',name: 'Model' },
        { variableId: 'serial_number', name: 'Serial Number' },
        { variableId: 'firmware_version', name: 'Firmware Version' },
        { variableId: 'deviceid', name: 'Device ID' },
        { variableId: 'flash_state', name: 'Flash State' },
        { variableId: 'last_command_sent',	name: 'Last Command Sent' },
        { variableId: 'last_command_received',	name: 'Last Command Received' },
        { variableId: 'preset_active',	name: 'Active Preset' },
    ]

    for (let i = 1; i <= self.channelcount; i++) {
		variableDefinitions.push({ variableId: `channel_name_${i}`, name: `Channel ${i} Name` })
		variableDefinitions.push({ variableId: `channel_mute_${i}`, name: `Channel ${i} Mute` })
	}

	for (let i = 1; i <= 10; i++) {
		variableDefinitions.push({ variableId: `preset_name_${i}`, name: `Preset ${i} Name` })
	}
	self.setVariableDefinitions(variableDefinitions)
}