var unirest = require('unirest');
var express = require('express');
var events = require('events');

var app = express();
app.use(express.static('public'));

/*
The getFromAPI function takes two arguments: an endpoint name, and an object containing arguments to provide in the query string of the endpoint. First an EventEmitter is created, which is used to communicate that getting the information was either successful or failed.
*/

/*
You use Unirest to make a GET request, adding the args as a query string using the qs method. When the end function is called from the HTTP response to tell you that all of the data has been received, you trigger your own end event on the emitter, attaching the response body which has been parsed by Unirest. In the case of an error, your own error event is triggered on the emitter, attaching the the error code returned by Unirest.
*/

var getFromApi = function(endpoint, args) {
    var emitter = new events.EventEmitter();
    unirest.get('https://api.spotify.com/v1/' + endpoint)
        .qs(args)
        .end(function(response) {
            emitter.emit('end', response.body);
        });
    return emitter;
};

/*

    For each related artist you should send out a parallel request to the top tracks endpoints.
        This should happen after the request to the get related artists endpoint
        It should use the artist IDs from the artist.related object
    If the request is successful, then the tracks attribute of the related artist should be set to item.tracks, where item is the object returned by the get related artists endpoint.
    When all of the requests have completed the entire artist object should be sent back to the client
    Your code should deal gracefully with any of the requests failing

Test out your code using the front end. You should see a list of top tracks added below each related artist.
*/

var getTracks = function(artist, cb) {
    unirest.get('https://api.spotify.com/v1/artists/' + artist.id + '/top-tracks?country=US')
        .end(function(response) {
           if (!response.error) {
               artist.tracks = response.body.tracks;
               //console.log(response.body);
               cb();
           } else {
               cb(response.error);
           }
        });
};

/*
Now let's set up a simple server to see this in action. When a user makes a request to /search/:name you are going to make a request to the Spotify /search endpoint to find information on the artist which they are looking for. 
*/

/*
First you create an HTTP server, using node-static to serve the front end. When a request to /search/:name is made you call the getFromApi function, telling it to use the endpoint /search?q=<name>&limit=1&type=artist. You then add listeners to the EventEmitter returned from getFromApi for the end and error events. When the end event is emitted, the function is called, which then extracts the artist from the object and returns it in a response. If there is an error, the error event handler's callback function sends that status code to the browser.
*/

app.get('/search/:name', function(req, res) {
  var searchReq = getFromApi('search', {
    q: req.params.name,
      limit: 1,
      type: 'artist'
  });

  /*
  
    Make a request to the get related artists endpoint
        This should happen after the search request has emitted its end event
        It should use the artist ID from the artist object
    If the request is successful, then artist.related should be set to item.artists, where item is the object returned by the get related artists endpoint.
    The entire artist object should then be sent as a response to the client.
    If the request is unsuccessful then a 404 error should be returned.

  */
  
  searchReq.on('end', function(item) {
      var artist = item.artists.items[0];
      unirest.get('https://api.spotify.com/v1/artists/' + artist.id + '/related-artists')
          .end(function(response) {
              if (!response.error) {
                  artist.related = response.body.artists;

                  // now get top tracks for all artists
                  var totalArtists = artist.related.length;
                  var completed = 0;

                  //console.log(totalArtists);
                  //console.log(completed);

                  var checkComplete = function() {
                      if (completed === totalArtists) {
                          res.json(artist);
                      }
                  };

                  artist.related.forEach(function(artist) {
                      getTracks(artist, function(err) {
                          if (err) {
                              res.sendStatus(404);
                          }

                          completed += 1;
                          checkComplete();

                      });
                  });

              } else {
                  res.sendStatus(404);
              }

          });
      
  });

  searchReq.on('error', function() {
      res.sendStatus(404);
  });

});


app.listen(process.env.PORT || 8080);