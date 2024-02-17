/**
 * 登录方式
 */
export const loginProviderType = {
  register: { value: 'register', label: '注册', h2: '免费注册', apiName: 'userERegister' },
  system: { value: 'system', label: '密码', h2: 'Login ', apiName: 'userELogin' },
  sms: { value: 'sms', label: '验证码', h2: '验证码登录', apiName: 'userMLoginMobile' },
};

/**
 * 短信验证码相关
 */
export const sms = {
  count: 60 * 1,
};

/**
 * 随机昵称:用户1234
 */
