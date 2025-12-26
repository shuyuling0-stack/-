import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App' // 确保路径指向上面的 App.tsx

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
