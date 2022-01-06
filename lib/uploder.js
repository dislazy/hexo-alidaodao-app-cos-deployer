'use strict';
const fs = require('hexo-fs');
const COS = require('cos-nodejs-sdk-v5');
const util = require('./util.js');
const path = require('path');
const chalk = require('chalk');
const QCSDK = require('./flushcdn');
const crypyo = require('./crypyo')

module.exports = function (args) {
    let cfgs = checkConfigs(this.config);
    if (!cfgs) return;

    let publicDir = this.public_dir;
    let localFileMap = new Map();
    let localImgsMap = new Map();


    if (!cfgs.cdnEnable) {
        //CDN功能未开启,开始获取 publicDir目录中的文件
        getFiles(publicDir, (file) => {
            localFileMap.set(getUploadPath(file), path.join(publicDir, file));
        })
    } else {
        let uploadDir = path.join(this.base_dir, '.coscache');
        let strRegExp = '(src="|content="|href=")([^"]*?\/' + cfgs.cdnConfig.folder + '\/)([^"]*?[\.jpg|\.jpeg|\.png|\.gif|\.zip]")';
        let imgRegExp = new RegExp(strRegExp, 'gi');
        // 获取本地文件
        getFiles(publicDir, (file) => {
            if (file.match(cfgs.cdnConfig.folder)) {
                //如果是图片目录，写入 localImgsMap 对象
                localImgsMap.set(getUploadPath(file).replace(cfgs.cdnConfig.folder + '\/', ''), path.join(publicDir, file));
            } else {
                //如果不是图片目录，开始下一步过滤
                if (file.match(/\.html$/)) {
                    //如果是 HTML文件，开始读取文件
                    let data = fs.readFileSync(path.join(publicDir, file));
                    if (imgRegExp.test(data)) {
                        //如果正则匹配，开始替换原路径为临时路径
                        var i = 0;
                        data = data.replace(imgRegExp, function (all, before, main, after) {
                            i++;
                            return before + cfgs.cdnConfig.cdnUrl + after;
                        });
                        //将替换完成的数据，写入临时目录
                        fs.writeFileSync(path.join(uploadDir, file), data);
                        //将临时路径，写入Map对象
                        localFileMap.set(getUploadPath(file), path.join(uploadDir, file));
                        console.log(chalk.green('replace ' + i + ' the relative path for CDN path，Owned file：' + path.join(uploadDir, file)));
                    } else {
                        //如果正则不匹配，直接写入原路径
                        localFileMap.set(getUploadPath(file), path.join(publicDir, file));
                    }
                } else {
                    //如果不是 HTML文件，直接写入原路径
                    localFileMap.set(getUploadPath(file), path.join(publicDir, file));
                }
            }
        });
    }

    function cosStart(fileMap, cfgs) {
        if (fileMap.size < 1) {
            return;
        }
        console.log(chalk.cyan('The local file is ready and is being downloaded from ' + cfgs.bucket + ' get a list of remote files..'));
        const cos = new COS({
            SecretId: cfgs.secretId, SecretKey: cfgs.secretKey
        });
        return getCosFiles(cos, cfgs)
            .then(cosFileMap => {
                if (cosFileMap.size > 0) {
                    console.log(chalk.cyan('Get the remote file successfully, start to compare the local file and the remote file..'));
                } else {
                    console.log(chalk.cyan('The remote warehouse is empty, start uploading all files..'));
                }
                return diffFileList(fileMap, cosFileMap);
            })
            .then(allFiles => {
                return deleteFile(cos, cfgs, allFiles.extraFiles)
                    .then(function (data) {
                        if (data !== false) {
                            console.log(chalk.cyan('Successfully delete the remote redundant files, start uploading local files..'));
                        }
                        return allFiles;
                    })
                    .catch(err => {
                        console.log(err);
                    })
            })
            .then(allFiles => {
                return uploadFile(cos, cfgs, allFiles.uploadFiles)
                    .then(function (data) {
                        if (data === 'ok') {
                            console.log(chalk.cyan('upload completed！'));
                        }
                        return allFiles.uploadFiles;
                    })
                    .then((filesMap) => {
                        return cacheRefresh(cfgs, filesMap)
                            .then((res) => {
                                if (res !== false) {
                                    console.log(chalk.cyan('Update cache completed！'));
                                }
                            })
                    })
                    .catch(err => {
                        console.log(chalk.red('Failed to update cache！'));
                        console.log(err);
                    })
            })
            .catch(err => {
                console.log(chalk.red('Failed to get remote file！'));
                console.log(err);
            })
    }

    return cosStart(localFileMap, cfgs)
        .then(function () {
            return cosStart(localImgsMap, cfgs)
        })
}

/**
 * 遍历目录，获取文件列表
 * @param {string} dir
 * @param {function}  callback
 */
function getFiles(dir, callback) {
    fs.listDirSync(dir).forEach((filePath) => {
        callback(filePath);
    });
}

/**
 * 获取上传文件的路径
 * @param {string} absPath
 * @return {string}
 */
function getUploadPath(absPath) {
    return absPath.split(path.sep).join('/');
}

/**
 * 更新CDN缓存
 * @param  {[type]} cfgs     [description]
 * @param  {[type]} filesMap [description]
 * @return {[type]}          [description]
 */
function cacheRefresh(cfgs, filesMap) {
    if (!cfgs.cdnEnable) {
        return true;
    }
    return new Promise((resolve, reject) => {
        resolve(QCSDK.flushCdn(cfgs.secretId, cfgs.secretKey, cfgs.cdnUrl));
    })
}

/**
 * 获取 Bucket 中的文件数据
 * @param {object} cos
 * @param {object} cfgs
 */
function getCosFiles(cos, cfgs) {
    return new Promise((resolve, reject) => {
        cos.getBucket({
            Bucket: cfgs.bucket, Region: cfgs.region
        }, (err, data) => {
            let cosFileMap = new Map();
            if (err) {
                reject(err)
            } else {
                data.Contents.forEach((item) => {
                    cosFileMap.set(item.Key, item.ETag);
                });
                resolve(cosFileMap)
            }
        })
    })
}

/**
 * 比较本地文件和远程文件
 * @param  {[type]} localFileMap [本地文件]
 * @param  {[type]} cosFileMap   [远程文件]
 * @return {[type]}              [返回上传文件列表和远程多余文件列表]
 */
function diffFileList(localFileMap, cosFileMap) {
    let extraFiles = [];
    return new Promise((resolve, reject) => {
        if (cosFileMap.size < 1) {
            resolve({
                extraFiles: extraFiles, uploadFiles: localFileMap
            })
        }
        var i = 0;
        cosFileMap.forEach(async (eTag, key) => {
            if (!localFileMap.has(key)) {
                extraFiles.push({Key: key});
            } else {
                await diffMd5(localFileMap.get(key)).then((md5) => {
                    if (md5 === eTag.substring(1, 33)) {
                        localFileMap.delete(key);
                    }
                })
            }
            ++i;
            if (i === cosFileMap.size) {
                resolve({
                    extraFiles: extraFiles, uploadFiles: localFileMap
                })
            }
        })
    })
}

function putObject(cos, config, file, filePath) {
    return new Promise((resolve, reject) => {
        cos.putObject({
            Bucket: config.bucket,
            Region: config.region,
            Key: file,
            Body: fs.createReadStream(filePath),
            ContentLength: fs.statSync(filePath).size,
            onProgress: function (progressData) {
            },
        }, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        })
    })
}

/**
 * upload file
 * @param {object} cos
 * @param {object} config
 * @param {object} file
 */
function uploadFile(cos, config, files) {
    return new Promise((resolve, reject) => {
        if (!files || files.size < 1) {
            console.log(chalk.cyan('No new files to upload！'));
            resolve()
        }
        var i = 0;
        files.forEach(async (file, filePath) => {
            await putObject(cos, config, filePath, file)
                .then(() => {
                    console.log(chalk.green('uploaded successfully：' + filePath));
                })
                .catch(err => {
                    console.log(chalk.red('upload failed！' + filePath));
                    console.log(err);
                })
            ++i;
            if (i === files.size) {
                resolve('ok')
            }
        })
    })
}

/**
 * 从远程仓库删除多余文件
 * @param {object} cos
 * @param {object} config
 * @param {Array} fileList
 */
function deleteFile(cos, config, fileList) {
    return new Promise((resolve, reject) => {
        if (fileList.length < 1) {
            resolve(false)
        }
        cos.deleteMultipleObject({
            Bucket: config.bucket, Region: config.region, Objects: fileList
        }, (err, data) => {
            if (err) {
                reject(err)
            } else {
                resolve(data)
            }
        })
    })
}

/**
 * 对比本地和远程文件的 MD5值
 * @param  {[type]} file [文件路径]
 * @return {[type]}      [description]
 */
function diffMd5(file) {
    return new Promise((resolve, reject) => {
        util.getFileMd5(fs.createReadStream(file), (err, md5) => {
            if (err) {
                reject(err)
            } else {
                resolve(md5);
            }
        })
    })
}

let tips = [chalk.red('由于配置错误，部署到 腾讯云COS 失败！'), '请检查根目录下的 _config.yml 文件中是否设置了以下信息', 'deploy:', '  - type: cos', '    encryptEnable: true or false', '    encryptSalt: salt', '    bucket: yourBucket', '    region: yourRegion', '    secretId: yourSecretId', '    secretKey: yourSecretKey', '    cdnEnable: true or false', '    cdnUrl: yourCdnUrl', '', '您还可以访问插件仓库，以获取详细说明： ' + chalk.underline('https://github.com/dislazy/hexo-alidaodao-app-cos-deployer')];

/**
 * 检查并处理设置项
 * @param  {[type]} config [hexo设置项]
 * @return {[type]}        [description]
 */
function checkConfigs(config) {
    let cfgs = config.deploy;
    for (let i = 0; i < cfgs.length; i++) {
        let deployConfig = cfgs[i]
        if (deployConfig.type === 'cos') {
            cfgs = deployConfig
        }
    }
    //校验基本信息不能出问题
    if (!cfgs.bucket || !cfgs.region || !cfgs.secretId || !cfgs.secretKey) {
        console.log(tips.join('\n'));
        return false;
    }

    //如果CDN开启，那么序列化一下对应的CDNURL
    if (cfgs.cdnEnable && !cfgs.cdnUrl) {
        console.log(tips.join('\n'));
        return false;
    }
    //校准一下对应的CDN地址
    if (cfgs.cdnEnable) {
        cfgs.cdnUrl = cfgs.cdnUrl.replace(/([^\/])$/, "$1\/");
    }

    if (cfgs.encryptEnable && !cfgs.encryptSalt) {
        console.log(tips.join('\n'));
        return false;
    }

    //如果配置有加密，那么需要将配置解密后返回给前端
    if (cfgs.encryptEnable) {
        cfgs.secretId = crypyo.decrypt(cfgs.secretId, cfgs.encryptSalt)
        cfgs.secretKey = crypyo.decrypt(cfgs.secretKey, cfgs.encryptSalt)
    }
}