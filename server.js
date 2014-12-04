var http = require('http');
var url = require('url');
var fs = require('fs');
var nodestatic = require('node-static');
var jqtpl = require("jqtpl");
var querystring = require('querystring');

var fileserver = new(nodestatic.Server)("./content", { cache: 1 });
var productData = JSON.parse(fs.readFileSync("./content/products.json"));

function handleRequest(req, res) {
    console.log(req.method + " request for " + req.url);      
    
    if (req.method == "POST") {
        var fullBody = '';
        req.on('data', function(chunk) {fullBody += chunk.toString();});
        req.on('end', function() {            
            var data = createDataObject(querystring.parse(fullBody));

            if (req.headers['x-http-method-override']) {
                var productID = req.url.split("/").pop();

                switch (req.headers['x-http-method-override']) {
                    case "delete":
                        data.deleteItem(productID);              
                        break;
                    case "put":
                        var item = data.getItem(productID);
                        if (item) {
                            item.name = data.getAndRemoveDataProp("name");
                            item.price = data.getAndRemoveDataProp("price")
                        }
                        break;
                }
                writeJSONData(res, productData);
            } else {                
                switch (req.url) {
                    case "/formecho":
                    case "/basket":
                    case "/shipping":
                    case "/summary":
                        res.write(jqtpl[jqtpl.tmpl ? "tmpl"
                            : "render"](loadTemplate(req.url.substring(1)), data));
                        break;
                }
                res.end();
            }
        });

    } else {
        
        if (req.url.indexOf("/shortJSONP") == 0) {
            var callback = querystring.parse(url.parse(req.url).query)["callback"];
            res.setHeader("Content-Type", "text/javascript");
            res.write(callback + "(" + JSON.stringify([productData[0]]) + ")");
            res.end();
            
        } else {
            
            if (req.headers["origin"] && req.headers["origin"].indexOf("cheeselux") > -1) {
                res.setHeader("Access-Control-Allow-Origin", req.headers["origin"]);
            }             
            
            switch (req.url) {

                case "/cheeselux.appcache":
                    fileserver.serveFile("cheeselux.appcache", 200,
                        {"Content-Type": "text/cache-manifest"}, req, res);
                    break;
                case "/products.json.slow":      
                    setTimeout(function() {                
                        fileserver.serveFile("products.json", 200, null, req, res);
                    }, 1000);
                    break;
                case "/shortJSONList":
                    writeJSONData(res, [productData[0]]);
                    break;
                case "/admin/products":
                    writeJSONData(res,  productData);
                    break;
                default:
                    if (req.url == "/") {
                        req.url = "/example.html";
                    }
                    fileserver.serve(req, res);        
                    break;
            };
        }
    }
}

http.createServer(handleRequest).listen(80);
console.log("Ready on port 80");

function loadTemplate(name) {
    return fs.readFileSync("content/" + name + ".html").toString();
}

function writeJSONData(res, data) {
    res.setHeader("Content-Type", "application/json");
    res.write(JSON.stringify(data));
    res.end();    
}

function createDataObject(reqData) {
    var data = {
        properties: [],
                
        getItem: function(id) {
            for (var i = 0; i < productData.length; i++) {
                for (var j = 0; j < productData[i].items.length; j++) {
                    if (productData[i].items[j].id == id) {
                        return productData[i].items[j];
                    }
                }
            }
            return null;
        },        
        
        deleteItem: function(id) {
            for (var i = 0; i < productData.length; i++) {
                for (var j = 0; j < productData[i].items.length; j++) {
                    if (productData[i].items[j].id == id) {               
                        productData[i].items.splice(j, 1);
                    }
                }
            }
        },

       getProp: function (id, prop) {            
            for (var i = 0; i < productData.length; i++) {
                for (var j = 0; j < productData[i].items.length; j++) {
                    if (productData[i].items[j].id == id) {
                        return productData[i].items[j][prop];
                    }
                }
            }
            return "";
        },
        
        getAndRemoveDataProp: function(prop) {
            for (var i = 0; i < this.properties.length; i++) {
                if (this.properties[i].propName == prop) {
                    var result = this.properties[i].propVal;
                    this.properties.splice(i, 1);
                    return result;
                }
            }
            return "";
        },
        
        total: 0,
        getSubtotal: function(id, quantity) {
            var price = this.getProp(id, "price") * quantity;
            this.total += price;
            return price;
        }
    }
    
    for (var prop in reqData) { 
         data.properties.push({propName: prop, propVal: reqData[prop]})
    }
    return data;
}

