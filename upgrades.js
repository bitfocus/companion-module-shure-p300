const { CreateConvertToBooleanFeedbackUpgradeScript } = require('@companion-module/base')

module.exports = [
	/*
	 * Place your upgrade scripts here
	 * Remember that once it has been added it cannot be removed!
	 */
	CreateConvertToBooleanFeedbackUpgradeScript({ flash_state: true }),
	// future scripts here
]