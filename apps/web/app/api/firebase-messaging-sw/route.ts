import { NextResponse } from 'next/server';

/**
 * Serves the FCM service worker. Config is read from the registration URL
 * query string (set by `registerWebPushWithApi`) so the SW stays env-agnostic.
 */
export function GET(): NextResponse {
  const body = `
/* eslint-disable */
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');

function readConfig() {
  try {
    var params = new URL(self.location.href).searchParams;
    return {
      apiKey: params.get('apiKey') || '',
      authDomain: params.get('authDomain') || '',
      projectId: params.get('projectId') || '',
      storageBucket: params.get('storageBucket') || '',
      messagingSenderId: params.get('messagingSenderId') || '',
      appId: params.get('appId') || '',
    };
  } catch (e) {
    return null;
  }
}

var config = readConfig();
if (config && config.apiKey && config.projectId && config.appId) {
  firebase.initializeApp(config);
  var messaging = firebase.messaging();

  messaging.onBackgroundMessage(function (payload) {
    var title =
      (payload.notification && payload.notification.title) ||
      (payload.data && payload.data.type) ||
      'Paradis Immo';
    var options = {
      body:
        (payload.notification && payload.notification.body) ||
        (payload.data && (payload.data.body || payload.data.message)) ||
        '',
      data: payload.data || {},
      icon: '/landing/logo.png',
      badge: '/landing/logo.png',
    };
    self.registration.showNotification(title, options);
  });
}

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var target = '/notifications';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url && 'focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(target);
          }
          return client;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(target);
      }
    }),
  );
});
`.trim();

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Service-Worker-Allowed': '/',
    },
  });
}
