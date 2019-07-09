# Newsfiltr (Backend)

This is the backend for my newsfiltr repo! 🤪

You may notice this NodeJS API uses generator functions to prevent nested callbacks and promise chains as opposed to using async/await...this is because I started designing this server template back before the async/await node module was implemented into the core of NodeJS. I have plans to refactor everything into async/await since it's cleaner and doesn't require the co library! 

If using this project, you have several options to allow for SSL if you want to deploy to a server. You can use NginX as a reverse proxy to be the mediator between your NodeJS API and all clients. This way, the NginX server can manage your SSL certificate and encryption. It's really easy this way. I actually have a blog post on my website about how to do this which can be found here: https://www.masonmahaffey.com/blog-post/using-nginx-as-a-reverse-proxy-for-your-api-on-ubuntu. Alternatively, you can use the existing code I've written into the template which manages SSL encryption for all requests to your API. All you need to do is drop your .pem certificate files into the ssl folder at the root of the project.

If you notice I don't have any controllers, this is due to the limited scope of my projects. I tend to not have a wide array of needs for my services as a lot of them are copy/paste being the same types of CRUD operations. However, I plan on adding them soon to make the growth in complexity of larger projects more logarithmic.

Lastly, I do not have test cases for this project as the scope of my side projects has in the past been fairly limited. As the projects I've worked on have grown however, I've decided to add jasmine test cases. This will be added soon.

