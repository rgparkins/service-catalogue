import _ from 'underscore';

class ServicenameValidatorMiddleware {
    constructor() {
        this.domains = [
        'domaina',
        'domainb',
        "engineering"
    ]}

    validateServiceName(name) {
        let self = this;

        var matched = _.find(self.domains, function(domain){
            return name.indexOf(`${domain}.`) === 0;
        });

        return !!matched;
    }
}

export default ServicenameValidatorMiddleware;
