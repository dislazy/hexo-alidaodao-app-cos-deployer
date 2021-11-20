// Depends on tencentcloud-sdk-nodejs version 4.0.3 or higher
const tencentcloud = require("tencentcloud-sdk-nodejs");
var _ = require('lodash');

const CdnClient = tencentcloud.cdn.v20180606.Client;

var QcloudSDK = function() {
    this.secretKey = '';
    this.secretId = '';
    this.cdnUrl ='';
}
QcloudSDK.prototype.config = function(userConfig) {
    checkUserConfig(userConfig)

    this.secretKey = userConfig.secretKey;
    this.secretId = userConfig.secretId;
    this.cdnUrl = userConfig.cdnUrl;
}

function checkUserConfig(userConfig) {

    if(!_.isPlainObject(userConfig)
        || !_.isString(userConfig['secretKey'])
        || !_.isString(userConfig['secretId'])
        || !_.isString(userConfig['cdnUrl'])
    ) {
        throw new Error('::config function should be called required an object param which contains secretKey[String] and secretId[String]')
    }
}


QcloudSDK.prototype.request = function(callback) {
    checkUserConfig({
        secretKey: this.secretKey,
        secretId: this.secretId,
        cdnUrl: this.cdnUrl
    })

    const clientConfig = {
        credential: {
            secretId: this.secretId,
            secretKey: this.secretKey,
        },
        region: "",
        profile: {
            httpProfile: {
                endpoint: "cdn.tencentcloudapi.com",
            },
        },
    };

    const client = new CdnClient(clientConfig);
    var params = {
        "Paths": [
            this.cdnUrl
        ],
        "FlushType": "delete",
        "UrlEncode": false
    };

    client.PurgePathCache(params).then(
        (data) => {
            console.log(data);
            callback("success");
        },
        (err) => {
            console.error("error", err);
            callback("error");
        }
    );
}

var qcloudSDK = new QcloudSDK();


module.exports = qcloudSDK;




