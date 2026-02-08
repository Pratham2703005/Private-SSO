### SSO + Clerk Architecture
I am thinking of building an SSO that will work like: i can register domains on my idp server and my idp server will be able to authenticate users from those domains.
And lets say if client A user logged in with account x then that user will be automatically log in whenever it goes to any other registered domains like on client B it auto logged in.
I want to basically build like an architecture of Clerk + SSO
like Clerk i will handle authentication and SSO will be handled by my idp server.
i want if my client A user log out then its client session revoke but its idp session still valid so if it reloads it log back in with same account.
i want idp server to provide ui on registered domains ui. like i am imagining in client A top right corner a user icon(guest, without login), clicking on that user icon show a small popup with add account, manage accounts and all the connected accounts
with one click on any account there, user login instantly without any login screen 
if user clicked on add account, it will redirect to idp server to login/signup page to add new account. and after adding account it will redirect back to client A with the new account added and logged in.
if user clicked on manage accounts, it will redirect to idp server to manage accounts page. and after managing accounts it will redirect back to client A.
this popup ui provide by idp server, the client A will just need to embed a script to show the popup.
