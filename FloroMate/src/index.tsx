/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/display-name */
import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './app'
import './App.css'

export default () => <App/>

let rootElement: ReactDOM.Root

export const mount = (Component: any, element: HTMLElement | null = document.getElementById('app')) => {
  if (!element) {
    console.error('❌ Ошибка: контейнер #app не найден!');
    return;
  }
  
  console.log('🚀 Монтируем приложение FloroMate в контейнер...');
  
  rootElement = ReactDOM.createRoot(element)
  rootElement.render(<Component/>)

  // @ts-ignore
  if(module.hot) {
    // @ts-ignore
    module.hot.accept('./app', () => {
      console.log('♻️ HMR: обновляем компоненты...');
      rootElement.render(<Component/>)
    })
  }
}

export const unmount = () => {
  if (rootElement) {
    console.log('🛑 Размонтируем приложение...');
    rootElement.unmount()
  }
}

// ✅ Экспортируем на window для доступа из броJS
// @ts-ignore
window.mount = mount;
// @ts-ignore
window.unmount = unmount;
// @ts-ignore
window.App = App;

console.log('✅ FloroMate модуль загружен. window.mount и window.App доступны.');

// ✅ Сразу монтируем при загрузке скрипта (для standalone режима)
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('app');
  if (container) {
    mount(App, container);
  }
});

// На случай, если DOM уже загружен
if (document.readyState === 'loading') {
  // DOM еще загружается, ждем события DOMContentLoaded выше
} else {
  // DOM уже загружен, монтируем сразу
  const container = document.getElementById('app');
  if (container && !container.hasChildNodes()) {
    mount(App, container);
  }
}
