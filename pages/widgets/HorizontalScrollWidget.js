const { BaseWidget } = require('./BaseWidget');

class HorizontalScrollWidget extends BaseWidget {
    constructor(page, config) {
        super(page, config);
        this.containerSelector = '.feedspace-element-horizontal-scroll-widget, .feedspace-left-right-shadow';
    }

    async validateUniqueBehaviors() {
        await this.initContext();
        this.logAudit('Validating Horizontal Scroll specialized behaviors...');
    }
}

module.exports = { HorizontalScrollWidget };
