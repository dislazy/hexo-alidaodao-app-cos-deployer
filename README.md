# hexo-alidaodao-app-cos-deployer

Hexo静态博客部署到腾讯云对象存储服务的插件，部署完成后会自动刷新被更新文件的CDN缓存。同时支持图片文件上传到单独对象存储中。

## 声明

**上传的时候，会自动清理远程bucket中的多余文件，请谨慎使用！**

** 更新 CDN缓存需要授权，如果使用子账号，请同时赋予该账号此权限！**

由于原插件停止更新，所以将原代码更新到了自己的仓库中，原仓库可以访问：https://github.com/75k/hexo-deployer-cos-enhanced

## 优点

1. 编辑博文时，可以实时预览插入的图片（使用 VSCode 和 它的 Paste Image 插件）。
2. 本地 `hexo s` 时，可以正常查看博文中插入的本地图片。
3. 最大化的利用腾讯云对象存储服务提供的免费额度（可以用两个腾讯云账号，一个放网站文件，一个放图片等文件）。
4. 存放图片的COS仓库，可以设置防盗链了。全放在一个仓库的话，是不能设置防盗链的哦。
5. 全站CDN，速度快到没朋友。

## 缺点

1. 域名需要备案，如果未备案无法使用。
2. 腾讯COS有免费额度，超过对应额度需要付费，请防范攻击

## 安装方法

``` bash
npm install hexo-alidaodao-app-cos-deployer --save
```

## 配置

``` yml
url: http://yourSite.com
deploy: 
  type: cos
  bucket: blog-1251123456
  region: ap-shanghai
  secretId: AKIDIgxxxxxxxxxxxxxxxxxxxx0SepjX
  secretKey: qXPCbxxxxxxxxxxxxxxxxxxxxsJZfdR
  cdnConfig:
    enable: true
    cdnUrl: http://yourCdnSite.com
    bucket: static-1251123456
    region: ap-shanghai
    folder: static-1251123456
    secretId: AKIDIgxxxxxxxxxxxxxxxxxxxx0SepjX
    secretKey: qXPCbxxxxxxxxxxxxxxxxxxxxsJZfdR
```

`type`： 是固定死的，只能是 cos。

`cdnUrl`： 是你的对象存储绑定的CDN域名，没有启用 CDN的话，推荐使用 [https://github.com/sdlzhd/hexo-deployer-cos](https://github.com/sdlzhd/hexo-deployer-cos)

`bucket` 和 `region`： 在腾讯云的对象存储中，新建或找到你的 bucket，然后找到 **默认域名** 信息，会看到一个类似这样的域名: `blog-1251123456.cos.ap-shanghai.myqcloud.com`，第一个点前面的 `blog-1251123456` 就是 `bucket` 名称，第二个点和第三个点之间的 `ap-shanghai`，就是你的 COS 所在地域，填写到 `region` 中。

`secretId` 和 `secretKey`：在 COS控制台中，找到左侧的**密钥管理**，点进去，按照提示添加子账号，并设置秘钥。同时要给子账号赋予 COS相关的权限，还有CDN刷新的权限。不会配置的可以参考 [官方示例](https://cloud.tencent.com/document/product/228/14867)

## License

MIT
