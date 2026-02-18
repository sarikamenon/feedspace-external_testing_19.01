const ConfigEngine = require('../core/ConfigEngine');

module.exports = {
    validate: (config) => {
        return ConfigEngine.validate(config);
    }
};
