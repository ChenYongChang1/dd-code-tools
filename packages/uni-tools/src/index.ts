import { getPlatform } from "./config/config";
import { EPlaform } from "./config/enum";
import { createMpWeixinUniPlugin } from "./plugins/mp-weixin";

/**
 * 创建 Chagee Uni 插件
 * @description 根据配置文件和传入选项创建插件实例
 * @param {Object} options - 插件配置选项
 * @returns {Object} 插件实例
 * @example
 * const plugin = createPlugin({
 *   env: 'production',
 *   customOption: 'value'
 * });
 */
export default (options?: Record<string, any>) => {
  const platform = getPlatform();
  return platform === EPlaform.MP_WEIXIN
    ? createMpWeixinUniPlugin(options)
    : [];
};
