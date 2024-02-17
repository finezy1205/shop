<script lang="ts">
export default {
  name: 'OrderList',
};
</script>

<script setup lang="ts">
import { reactive, ref, unref } from 'vue';
import { useRoute } from 'vue-router';

import API_ORDER from '@/apis/order';
import OrderItem from './components/OrderItem.vue';
import { orderListModel } from '@/model/modules/order/list';
import { usePage } from '@/hooks/shared/usePage';

const route = useRoute();
const { onMountedOrActivated } = usePage();

onMountedOrActivated(() => {
  const { status } = route.query;
  if (status) {
    active.value = unref(tabList).findIndex((item) => item.status === status);
  }

  listRef.value?.loadData();
});

const tabList = ref<Recordable[]>([
  { name: 'All', status: '' },
  { name: 'To Pay', status: '0' },
  { name: 'To Ship', status: '1' },
  { name: 'To Receive', status: '2' },
  { name: 'To Review', status: '3' },
]);
const active = ref(0);

function onTabClicked() {
  listQueryType.value = 'query';
  listRef.value?.refresh();
}

const keyword = ref('');

function onSearch() {
  listQueryType.value = 'search';
  listRef.value?.refresh();
}

const listRef = ref<any>(null);
const list = ref<Recordable[]>([]);
const pagination = reactive({
  pageCurrent: 1,
  pageSize: 10,
});
const listQueryType = ref('query');

const listMeta = reactive({
  loadingText: 'Loading...',
  emptyText: '暂无订单',
});

function onOrderItemDelete(_item, index: number) {
  list.value.splice(index, 1);
}

function getOrderList() {
  const params = {
    page: pagination.pageCurrent,
    pageSize: pagination.pageSize,
    status: unref(tabList)[unref(active)].status,
  };

  if (unref(keyword)) {
    params['orderNumber'] = unref(keyword); // 订单编号
  }

  listMeta.emptyText = unref(listQueryType) === 'search' ? '未找到符合条件数据' : '暂无订单';

  return API_ORDER.orderList(params);
}

function listAfterFetch(data) {
  const records = orderListModel(data?.orderList ?? [], data?.goodsMap ?? []);
  return records;
}
</script>

<template>
  <div class="container">
    <van-sticky>
      <div class="header">
        <form action="#" class="search-form">
          <van-search
            v-model="keyword"
            class="search-field"
            shape="round"
            show-action
            placeholder="Search Order（order number）"
            @search="onSearch"
          >
            <template #action>
              <div v-if="keyword" @click="onSearch">Search</div>
            </template>
          </van-search>
        </form>
        <van-tabs v-model:active="active" @click-tab="onTabClicked">
          <van-tab v-for="(item, index) in tabList" :key="index" :title="item.name" />
        </van-tabs>
      </div>
    </van-sticky>

    <ProList
      ref="listRef"
      v-model:dataSource="list"
      mode="infinite"
      :api="getOrderList"
      :afterFetch="listAfterFetch"
      :pagination="pagination"
      :meta="listMeta"
    >
      <div class="list">
        <OrderItem
          v-for="(item, index) in list"
          :key="item.id"
          :item="item"
          :index="index"
          @delete="onOrderItemDelete"
        />
      </div>
    </ProList>
  </div>
</template>

<style lang="less" scoped>
// ...
.van-tabs{

  :is(.van-tab){
    font-size: 12px;
  }
}
</style>
