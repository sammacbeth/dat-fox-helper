const DatGateway = require('dat-gateway');

const gateway = new DatGateway({
    dir: '.dat-gateway',
    max: 20,
    maxAge:  10 * 60 * 1000,
});

module.exports = {
    startGateway: ({ port=3000 }) => {
        return gateway.listen(port);
    },
}