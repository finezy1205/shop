<script lang="ts">
export default {
  name: 'OrderSubmit',
};
</script>

<script setup lang="ts">
import { computed, onMounted, ref, unref, reactive, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { showConfirmDialog, showToast, showLoadingToast, closeToast } from 'vant';
import NP from 'number-precision';
import API_USER from '@/apis/user';
import API_ORDER from '@/apis/order';
import API_CART from '@/apis/cart';
import { decimalFormat, mobileShow } from '@/utils/format';
import SelectAddress from './components/SelectAddress.vue';
import GoodCard from '@/components/GoodCard/index.vue';

import { useOrderStore } from '@/store/modules/order';

onMounted(() => {
  if (unref(isNeedLogistics)) {
    getAddressInfo();
  }

  getUserAmount();
  getOrderSetInfo();
});

const router = useRouter();
const orderStore = useOrderStore();

// 地址信息
const addressInfo = ref<Recordable>({});
const addressPopupShow = ref(false);

function onAddressClicked() {
  addressPopupShow.value = true;
}

function formatAreaStr(provinceStr: string, cityStr: string, countyStr: string) {
  let str = provinceStr;

  cityStr.length > 1 && cityStr !== provinceStr && (str += `${cityStr}`);
  countyStr.length > 1 && (str += `${countyStr}`);

  return str;
}

function onAddressSelected(item: Recordable) {
  addressInfo.value = item;
}

function getAddressInfo() {
  API_USER.userShoppingAddressDefault().then((res) => {
    addressInfo.value = res.data?.info ?? {};
  });
}

// 钱包
const balance = ref<number>(0);
// const balanceSwitch = ref<boolean>(true);
const balanceChecked = ref('1');
const creditFormRef = ref();
const creditForm = reactive({
  cardNumber: '',
  expiration: '',
  cvv: '',
});
const expirationChange = (value: string) => {
  if (value.length === 3 && value.indexOf('\/') === -1) {
    creditForm.expiration = `${value.substring(0, 2)}/${value.substring(2)}`;
    nextTick(() => {
      const $el = document.getElementsByName('expiration')[0];
      // @ts-ignore
      $el!.setSelectionRange(4, 4);
    });
  } else if (value.length < 4) {
    creditForm.expiration = `${value.substring(0, 2)}`;
  }
};
function getUserAmount() {
  API_USER.userAmount().then((res) => {
    balance.value = res.data?.balance ?? 0;
  });
}

const orderSetInfo = ref<Recordable>({});
function getOrderSetInfo() {
  API_ORDER.orderSet().then((res) => {
    orderSetInfo.value = res.data || {};
  });
}

const remark = ref('');

const tradeGoods = computed(() => orderStore.getTradeGoods);
const goodList = computed(() => unref(tradeGoods).list);
const submitLoading = ref(false);
// 只要包含一件实物商品，就需要物流信息
const isNeedLogistics = computed(() => unref(goodList).some((v: Recordable) => v.logisticsId !== 0));
const totalPrice = computed(() =>
  unref(goodList).reduce((acc, cur) => NP.plus(acc, NP.times(cur.price, cur.number)), 0),
);

async function onSubmit() {
  if (unref(isNeedLogistics) && !unref(addressInfo).linkMan) {
    return showToast({ message: '地址栏不能为空', duration: 1500 });
  }
  if (balanceChecked.value === '3') {
    try {
      await creditFormRef.value.validate();
    } catch (error) {
      return creditFormRef.value.scrollToField(error?.[0].name);
    }
  }
  // if (unref(balance) < unref(totalPrice)) {
  //   showConfirmDialog({
  //     title: '余额不足',
  //     message: '积分兑换成余额，再来消费',
  //     confirmButtonText: '我知道了',
  //   })
  //     .then(() => {})
  //     .catch(() => {
  //       // on cancel
  //     });
  //   return;
  // }

  createOrder();
}

/**
 * 创建订单
 */
async function createOrder() {
  const goods = unref(goodList).map((item) => ({
    goodsId: item.goodsId,
    number: item.number,
    propertyChildIds: item.propertyList.map((v) => v.propIds).join(','),
  }));

  const params: Recordable = {
    calculate: false, // true 不实际下单，而是返回价格计算
    goodsType: 0, // 自营商品
    goodsJsonStr: JSON.stringify(goods), // 购买的商品信息的数组
    expireMinutes: unref(orderSetInfo).closeMinute || 60, // 多少分钟未支付自动关闭本订单，传0不自动关闭订单
    remark: unref(remark),
  };

  if (unref(isNeedLogistics)) {
    params.peisongType = 'kd'; // 配送类型，kd 代表快递；zq代表到店自取
    params.linkMan = unref(addressInfo).linkMan;
    params.mobile = unref(addressInfo).mobile;
    params.address = unref(addressInfo).address;
    params.provinceId = unref(addressInfo).provinceId;
    params.cityId = unref(addressInfo).cityId;
    params.districtId = unref(addressInfo).districtId;
  } else {
    params.autoDeliver = true; // 虚拟商品，自动发货
  }

  showLoadingToast({
    forbidClick: true,
    message: 'Creating...',
    duration: 0,
  });
  submitLoading.value = true;

  try {
    const res = await API_ORDER.orderCreate(params);

    if (unref(tradeGoods).origin === 'cart') {
      cartEmptyHandle();
    }

    await payOrder(res.data.id);

    closeToast();
    submitLoading.value = false;
    router.replace({
      path: '/order/payResult',
      query: {
        orderNumber: res.data.orderNumber,
      },
    });
  } catch (error) {
    closeToast();
    submitLoading.value = false;
    console.error(error);
  }
}

/**
 * 付款方式 有且仅有一种 钱包支付T.T
 */
function payOrder(orderId: number) {
  return API_ORDER.orderPay({ orderId });
}

/**
 * 下单商品购物车来源时，直接清空购物车（ TODO: 考虑是否选中）
 */
function cartEmptyHandle() {
  API_CART.shoppingCartEmpty()
    .then(() => {})
    .catch((err) => {
      console.log(err);
    });
}
</script>

<template>
  <div class="container">
    <!-- 收货地址 -->
    <div v-if="isNeedLogistics" class="section">
      <div v-if="addressInfo.linkMan" class="address" @click="onAddressClicked">
        <!--        <div class="address-sub van-ellipsis">-->
        <!--          {{ formatAreaStr(addressInfo.provinceStr, addressInfo.cityStr, addressInfo.areaStr) }}-->
        <!--        </div>-->
        <div class="address-title van-ellipsis">{{ addressInfo.address }}</div>
        <div class="address-sub van-ellipsis">{{ addressInfo.linkMan }} {{ mobileShow(addressInfo.mobile) }}</div>
        <van-icon class="address-arrow" name="arrow" />
      </div>
      <van-cell
        v-else
        class="address-card mb10"
        title="New address"
        icon="add-square"
        is-link
        @click="onAddressClicked"
      ></van-cell>
      <van-cell title="Ship Info" value="Standard Delivery"></van-cell>
      <SelectAddress v-model="addressPopupShow" @select="onAddressSelected" />
    </div>
    <!-- 商品列表 -->
    <div class="section">
      <div class="section-header van-hairline--bottom">
        <van-icon class="section-header-icon" name="shop-o" />
        <span class="section-header-title">Product List</span>
      </div>
      <div class="list">
        <GoodCard v-for="(item, index) in goodList" :key="index" :good="item" />
      </div>
      <div class="subtotal">
        <span class="subtotal-num">{{ goodList.length }}Item</span>
        <span class="subtotal-label">Total：</span>
        <span class="subtotal-price">
          <span class="subtotal-price-symbol">¥</span>
          <span class="subtotal-price-integer">{{ decimalFormat(totalPrice) }}</span>
        </span>
      </div>
    </div>
    <!-- 备注 -->
    <div class="section">
      <van-field
        v-model="remark"
        label="Message"
        type="textarea"
        placeholder="leave a message"
        maxlength="250"
        rows="1"
        autosize
      />
    </div>
    <!-- 付款方式 默认钱包支付-->
    <div class="section">
      <div class="section-header van-hairline--bottom">
        <span class="section-header-title">Payment Method</span>
      </div>
      <van-radio-group v-model="balanceChecked">
        <van-cell title="Balance" center>
          <template #label> Balance：{{ decimalFormat(balance) }} </template>
          <template #right-icon>
            <van-radio name="1"></van-radio>
            <!-- <van-checkbox :model-value="balanceSwitch"> </van-checkbox> -->
          </template>
        </van-cell>
        <van-cell title="Payment after Arrival of Goods" center>
          <!-- <template #label>  </template> -->
          <template #right-icon>
            <van-radio name="2"></van-radio>
          </template>
        </van-cell>
        <van-cell title="Credit Card" center>
          <!-- <template #label>  </template> -->
          <template #right-icon>
            <van-radio name="3"></van-radio>
          </template>
        </van-cell>
      </van-radio-group>
      <!-- 信用卡 -->
      <van-form v-show="balanceChecked === '3'" ref="creditFormRef" class="section">
        <van-cell-group inset>
          <van-field
            v-model="creditForm.cardNumber"
            type="digit"
            name="Card Number"
            label="Card Number"
            placeholder="Credit Card Number"
            :rules="[{ required: true, message: 'Please enter a credit card number.' }]"
          />
          <van-field
            v-model="creditForm.expiration"
            name="expiration"
            label="Expiration"
            placeholder="MM/YY"
            maxlength="5"
            :rules="[{ required: true, message: 'Please enter a valid expiration date.' }]"
            @update:model-value="expirationChange"
          />
          <van-field
            v-model="creditForm.cvv"
            type="digit"
            name="CVV"
            label="CVV"
            placeholder="CVV"
            maxlength="4"
            :rules="[{ required: true, message: 'Please enter a credit security code.' }]"
          />
        </van-cell-group>
      </van-form>
    </div>
    <!--提交订单栏 -->
    <div class="submit-bar-wrap">
      <div class="submit-bar">
        <div class="submit-bar-hd">
          <span class="submit-bar-total">Pay：</span>
          <div class="submit-bar-price">
            <span class="submit-bar-price-symbol">¥</span>
            <span class="submit-bar-price-integer">{{ decimalFormat(totalPrice) }}</span>
          </div>
        </div>
        <van-button class="submit-bar-button" :loading="submitLoading" round type="primary" @click="onSubmit">
          Submit
        </van-button>
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
.section {
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
  margin: 12px 10px;
  border-radius: 8px;
  background-color: var(--color-bg-2);

  &-header {
    font-size: 14px;
    padding: 10px 15px;
    display: flex;
    align-items: center;
    margin-bottom: 2px;

    &-icon {
      margin-right: 8px;
      font-size: 18px;
    }

    &-title {
      font-weight: bold;
    }

    &.van-hairline--bottom::after {
      right: -40%;
      left: -40%;
    }
  }
}

.subtotal {
  box-sizing: border-box;
  padding: 0 15px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  height: 44px;
  font-size: 14px;
  color: var(--color-text-1);

  &-num {
    margin-right: 8px;
  }

  &-price {
    color: var(--color-primary);
    &-symbol {
      font-size: 12px;
      margin-right: 2px;
    }

    &-integer {
      font-size: 16px;
      font-family: @font-family-price-integer;
    }
  }
}

.submit-bar {
  box-sizing: border-box;
  position: fixed;
  left: 0;
  bottom: var(--safe-area-height-bottom);
  z-index: 100;
  width: 100%;
  padding: 0 16px;
  background-color: var(--color-bg-2);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  height: 50px;
  font-size: 14px;
  box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.5);

  &-wrap {
    height: calc(50px + var(--safe-area-height-bottom));
  }

  &-hd {
    flex: 1;
    display: flex;
    align-items: center;
    padding-right: 15px;
    color: var(--color-text-1);
  }

  &-price {
    color: var(--color-primary);
    font-weight: bold;

    &-symbol {
      font-size: 12px;
      margin-right: 2px;
    }

    &-integer {
      font-size: 20px;
      font-family: @font-family-price-integer;
    }
  }

  &-button {
    width: 110px;
    height: 40px;
  }
}

.address {
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: auto;
  padding: 16px 40px 12px 12px;

  &-arrow {
    position: absolute;
    right: 12px;
    top: 0;
    bottom: 0;
    margin: auto 0;
    height: 16px;
  }

  &-title {
    font-size: 17px;
    color: var(--color-text-1);
    font-weight: bold;
    margin: 8px 0;
  }

  &-sub {
    font-size: 13px;
    color: var(--color-text-1);
  }

  &:before {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    height: 2px;
    background: -webkit-repeating-linear-gradient(
      135deg,
      #ff6c6c 0,
      #ff6c6c 20%,
      transparent 0,
      transparent 25%,
      #1989fa 0,
      #1989fa 45%,
      transparent 0,
      transparent 50%
    );
    background: repeating-linear-gradient(
      -45deg,
      #ff6c6c 0,
      #ff6c6c 20%,
      transparent 0,
      transparent 25%,
      #1989fa 0,
      #1989fa 45%,
      transparent 0,
      transparent 50%
    );
    background-size: 80px;
    content: '';
  }
}

.address-card {
  position: relative;
  padding: 10px 15px;
  align-items: center;
  &:before {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    height: 2px;
    background: -webkit-repeating-linear-gradient(
      135deg,
      #ff6c6c 0,
      #ff6c6c 20%,
      transparent 0,
      transparent 25%,
      #1989fa 0,
      #1989fa 45%,
      transparent 0,
      transparent 50%
    );
    background: repeating-linear-gradient(
      -45deg,
      #ff6c6c 0,
      #ff6c6c 20%,
      transparent 0,
      transparent 25%,
      #1989fa 0,
      #1989fa 45%,
      transparent 0,
      transparent 50%
    );
    background-size: 80px;
    content: '';
  }
}
.address-card :deep(.van-cell__left-icon) {
  color: #1989fa;
  font-size: 40px;
}
.address-card :deep(.van-cell__title) {
  line-height: 40px;
}
</style>
