import { createApp } from "vue";
import {
  ElAlert,
  ElButton,
  ElCard,
  ElConfigProvider,
  ElIcon,
  ElTable,
  ElTableColumn,
  ElTag,
} from "element-plus";
import "element-plus/dist/index.css";
import "./style.css";
import App from "./App.vue";

const app = createApp(App);

for (const component of [ElAlert, ElButton, ElCard, ElConfigProvider, ElIcon, ElTable, ElTableColumn, ElTag]) {
  if (component.name) app.component(component.name, component);
}

app.mount("#app");
