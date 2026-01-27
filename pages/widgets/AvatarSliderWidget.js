const { BaseWidget } = require('./BaseWidget');

class AvatarSliderWidget extends BaseWidget {
    constructor(page, config) {
        super(page, config);
        this.containerSelector = '.feedspace-single-review-widget, .feedspace-show-left-right-shadow';
    }

    async validateUniqueBehaviors() {
        await this.initContext();
        this.logAudit('Validating Avatar Slider specialized behaviors...');
    }
}

module.exports = { AvatarSliderWidget };
