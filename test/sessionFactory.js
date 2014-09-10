// Generated by CoffeeScript 1.7.1
(function() {
  var SessionFactory, factory;

  SessionFactory = require('../index').SessionFactory;

  factory = new SessionFactory('/home/peter/work/nodebatis/xml', {
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'test',
    connectionLimit: 3
  });

  console.log('SessionFactory init...');

  exports.sessionFactory = factory;

}).call(this);
