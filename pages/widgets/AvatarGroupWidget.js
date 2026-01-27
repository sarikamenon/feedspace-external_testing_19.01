const { BaseWidget } = require('./BaseWidget');

class AvatarGroupWidget extends BaseWidget {
    constructor(page, config) {
        super(page, config);
        this.containerSelector = '.fe-feedspace-avatar-group-widget-wrap, .fe-widget-center';
    }

    async validateUniqueBehaviors() {
        await this.initContext();
        this.logAudit('Validating Avatar Group specialized behaviors...');
    }
}

module.exports = { AvatarGroupWidget };
