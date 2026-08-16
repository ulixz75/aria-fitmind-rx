/**
 * @project     ARIA — FitMind Rx
 * @description Audio Rep Intelligence Advisor · Voice Coach
 *              Realtime AI coaching platform with Firebase backend
 *              and OpenAI GPT Realtime 2.1 Mini over WebRTC.
 *
 * @copyright   © FitMind Rx by Arcusgroup. All rights reserved.
 *
 * @stack       React · TypeScript · Vite · PWA
 * @auth        Firebase Auth — Google / Email+Password
 * @database    Firestore · Firebase Storage
 * @voice       GPT Realtime 2.1 Mini · WebRTC
 */


import React from "react";
import ReactDOM from "react-dom/client";
import {BrowserRouter} from "react-router-dom";
import {AuthProvider} from "./context/AuthContext";
import App from "./app/App";
import "./styles/global.css";
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><BrowserRouter><AuthProvider><App/></AuthProvider></BrowserRouter></React.StrictMode>);
