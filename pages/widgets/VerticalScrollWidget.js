const { BaseWidget } = require('./BaseWidget');

class VerticalScrollWidget extends BaseWidget {
    constructor(page, config) {
        super(page, config);
        this.containerSelector = '.feedspace-element-feed-top-bottom-marquee, .feedspace-top-bottom-shadow';
    }

    async validateUniqueBehaviors() {
        await this.initContext();
        this.logAudit('Validating Vertical Scroll specialized behaviors...');
    }
}

module.exports = { VerticalScrollWidget };
