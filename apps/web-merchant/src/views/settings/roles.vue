<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import { onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Button,
  Checkbox,
  Input,
  message,
  Modal,
  Select,
  Table,
  Tag,
} from 'ant-design-vue';

import { requestClient } from '#/api/request';

type Menu = { children?: Menu[]; id: string; label: string };
type Role = {
  id: number;
  menuCount: string;
  menus: string[];
  name: string;
  staffCount: number;
  status: string;
  system: boolean;
};

const menus = ref<Menu[]>([]);
const roles = ref<Role[]>([]);
const createOpen = ref(false);
const permOpen = ref(false);
const editingId = ref<null | number>(null);
const name = ref('');
const status = ref('启用');
const picked = ref<string[]>([]);
const system = ref(false);

const columns: TableColumnsType<Role> = [
  { title: '岗位', dataIndex: 'name', key: 'name' },
  { title: '菜单', dataIndex: 'menuCount', key: 'menus', width: 90 },
  { title: '员工', dataIndex: 'staffCount', key: 'staff', width: 80 },
  { title: '状态', key: 'status', width: 90 },
  { title: '操作', key: 'action', width: 90 },
];

function leaves(nodes: Menu[]): Menu[] {
  return nodes.flatMap((node) =>
    node.children?.length ? leaves(node.children) : [node],
  );
}

async function load() {
  menus.value = await requestClient.get<Menu[]>('/org/menus');
  roles.value = await requestClient.get<Role[]>('/org/roles');
}

function openCreate() {
  editingId.value = null;
  name.value = '';
  status.value = '启用';
  createOpen.value = true;
}

function openPerm(role: Role) {
  editingId.value = role.id;
  name.value = role.name;
  status.value = role.status;
  system.value = role.system;
  picked.value = role.menus.includes('*')
    ? leaves(menus.value).map((item) => item.id)
    : [...role.menus];
  permOpen.value = true;
}

async function createRole() {
  const created = await requestClient.post<{ id: number }>('/org/roles', {
    name: name.value,
    status: status.value,
    menus: ['dashboard'],
  });
  createOpen.value = false;
  await load();
  const role = roles.value.find((item) => item.id === created.id);
  if (role) openPerm(role);
}

async function savePerm() {
  await requestClient.put(`/org/roles/${editingId.value}`, {
    name: name.value,
    status: status.value,
    menus: picked.value,
  });
  message.success('岗位权限已保存');
  permOpen.value = false;
  await load();
}

onMounted(load);
</script>

<template>
  <Page title="岗位与权限">
    <div class="toolbar">
      <span class="muted">岗位决定员工登录后可见的商家菜单。系统内置的商户管理员拥有全部菜单，不能修改。</span>
      <Button type="primary" @click="openCreate">新增岗位</Button>
    </div>
    <Table
      :columns="columns"
      :data-source="roles"
      :pagination="false"
      row-key="id"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <Tag :color="record.status === '启用' ? 'green' : 'default'">
            {{ record.status }}
          </Tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <Button size="small" type="link" @click="openPerm(record as Role)">
            配置
          </Button>
        </template>
      </template>
    </Table>
    <Modal v-model:open="createOpen" title="新增岗位" @ok="createRole">
      <Input v-model:value="name" placeholder="岗位名称" />
      <Select
        v-model:value="status"
        :options="[
          { label: '启用', value: '启用' },
          { label: '停用', value: '停用' },
        ]"
        class="field"
      />
    </Modal>
    <Modal
      v-model:open="permOpen"
      :ok-button-props="{ disabled: system }"
      title="配置岗位权限"
      width="680px"
      @ok="savePerm"
    >
      <p class="muted">
        {{
          system
            ? '系统内置岗位拥有全部商家菜单，不可修改。'
            : '勾选该岗位可访问的商家菜单。'
        }}
      </p>
      <Input v-model:value="name" :disabled="system" placeholder="岗位名称" />
      <Select
        v-model:value="status"
        :disabled="system"
        :options="[
          { label: '启用', value: '启用' },
          { label: '停用', value: '停用' },
        ]"
        class="field"
      />
      <div v-for="group in menus" :key="group.id" class="group">
        <b>{{ group.label }}</b>
        <div class="checks">
          <Checkbox
            v-for="item in group.children || [group]"
            :key="item.id"
            :checked="picked.includes(item.id)"
            :disabled="system"
            @change="
              picked = $event.target.checked
                ? [...picked, item.id]
                : picked.filter((id) => id !== item.id)
            "
          >
            {{ item.label }}
          </Checkbox>
        </div>
      </div>
    </Modal>
  </Page>
</template>

<style scoped>
.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.muted {
  font-size: 12px;
  color: #8c8c8c;
}

.field {
  width: 100%;
  margin-top: 12px;
}

.group {
  margin-top: 14px;
}

.checks {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-top: 8px;
}
</style>
