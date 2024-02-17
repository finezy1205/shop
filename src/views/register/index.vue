<script setup lang="ts">
import { computed, ref, unref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast } from 'vant';
import { isEmail, isPassWord, isSame } from '@/utils/validate';
import { fakeNickName } from '@/model';

import { useUserStore } from '@/store/modules/user';

const userStore = useUserStore();

const router = useRouter();
const route = useRoute();

const title = ref('Register');
const email = ref('');
const smsCode = ref('');
const pwd = ref('123123123');
const pwd2 = ref('123123123');
const agree = ref(true);

const submitLoading = ref(false);
const submitted = computed(() => {
  return unref(email) && unref(pwd) && unref(pwd2);
});

function onSubmit() {
  if (!isEmail(unref(email))) {
    showToast('email error');
    return;
  }

  if (!isPassWord(unref(pwd))) {
    showToast('password limit 6-25');
    return;
  }

  if (!isSame(unref(pwd), unref(pwd2))) {
    showToast('password mismatch');
    return;
  }

  const params = {
    email: unref(email),
    // code: unref(smsCode),
    // nick: fakeNickName({ type: 'mobile', mobile: unref(mobile) }),
    pwd: unref(pwd),
    autoLogin: true,
  };

  submitLoading.value = true;

  userStore
    .login({ provider: 'register', params })
    .then(() => {
      submitLoading.value = false;
      route.query.redirect ? router.replace({ path: route.query.redirect as string }) : router.replace({ path: '/' });
      showToast({
        type: 'success',
        message: 'Success',
      });
    })
    .catch((err) => {
      console.error(err);
      submitLoading.value = false;
    });
}
</script>

<template>
  <div class="container">
    <div class="main">
      <div class="h2">{{ title }}</div>
      <form class="form">
        <div class="form-item">
<!--          <div class="form-item-country">中国 +86</div>-->
          <van-field
            v-model="email"
            class="form-field"
            :border="false"
            type="tel"
            placeholder="Please Enter Email Address"
            clearable
          />
        </div>
<!--        <div class="form-item">-->
<!--          <CaptchaCodeField-->
<!--            v-model="smsCode"-->
<!--            :mobile="mobile"-->
<!--            class="form-field"-->
<!--            :border="false"-->
<!--            type="number"-->
<!--            maxlength="4"-->
<!--            placeholder="请输入4位验证码"-->
<!--            clearable-->
<!--          />-->
<!--        </div>-->
        <div class="form-item">
          <PwdField
            key="pwd"
            v-model="pwd"
            class="form-field"
            :border="false"
            placeholder="Please Enter Password"
            autocomplete="new-password"
            clearable
          />
        </div>
        <div class="form-item">
          <PwdField
            key="pwd2"
            v-model="pwd2"
            class="form-field"
            :border="false"
            placeholder="Please Comfirm Password"
            autocomplete="new-password"
            clearable
          />
        </div>
        <van-button
          class="form-submit"
          block
          :disabled="!submitted"
          :loading="submitLoading"
          loading-text="Loading..."
          type="primary"
          @click="onSubmit"
          >Confirm</van-button
        >
      </form>
    </div>
<!--    <div class="footer">-->
<!--      <div class="footer-agreement">-->
<!--        <van-checkbox v-model="agree" icon-size="16px" />-->
<!--        <span> 阅读并同意</span><a href="javascript:void(0);">《用户协议》</a>和<a href="javascript:void(0);"-->
<!--          >《隐私政策》</a-->
<!--        >-->
<!--      </div>-->
<!--    </div>-->
  </div>
</template>

<style lang="less" scoped>
@import '@/styles/mixins/login.less';

.login();
</style>
