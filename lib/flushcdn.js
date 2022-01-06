// Depends on tencentcloud-sdk-nodejs version 4.0.3 or higher
const tencentcloud = require("tencentcloud-sdk-nodejs");
var _ = require('lodash');

const CdnClient = tencentcloud.cdn.v20180606.Client;

function checkUserConfig(userConfig) {

    if (!_.isPlainObject(userConfig) || !_.isString(userConfig['secretKey']) || !_.isString(userConfig['secretId']) || !_.isString(userConfig['cdnUrl'])) {
        throw new Error('::config function should be called required an object param which contains secretKey[String] and secretId[String]')
    }
}

//加密
const flushCdn = (secretId, secretKey, cdnUrl) => {
    checkUserConfig({
        secretKey: secretKey, secretId: secretId, cdnUrl: cdnUrl
    })

    const clientConfig = {
        credential: {
            secretId: secretId, secretKey: secretKey,
        }, region: "", profile: {
            httpProfile: {
                endpoint: "cdn.tencentcloudapi.com",
            },
        },
    };

    const client = new CdnClient(clientConfig);
    var params = {
        "Paths": [cdnUrl], "FlushType": "delete", "UrlEncode": false
    };
    let result = false;
    client.PurgePathCache(params).then((data) => {
        console.log(data);
        result = true;
    }, (err) => {
        console.error("error", err);
        result = false;
    });
    return result;
}


module.exports = {
    flushCdn
};



