
var request = require('supertest');
var mount = require('..');
var koa = require('koa');
var should = require('should');

describe('mount(app)', function(){
  it('should mount at /', function(done){
    var a = koa();
    var b = koa();

    a.use(function *(next){
      yield next;
      if ('/hello' == this.path) this.body = 'Hello';
    });

    b.use(function *(next){
      yield next;
      if ('/world' == this.path) this.body = 'World';
    });

    var app = koa();
    app.use(mount(a));
    app.use(mount(b));

    request(app.listen())
    .get('/')
    .expect(404)
    .end(function(err){
      if (err) return done(err);

      request(app.listen())
      .get('/hello')
      .expect('Hello')
      .end(function(err){
        if (err) return done(err);

        request(app.listen())
        .get('/world')
        .expect('World', done);
      });
    });
  })
})

describe('mount(path, app)', function(){
  it('should mount the app at the given path', function(done){
    var app = koa();
    var a = koa();
    var b = koa();

    a.use(function *(next){
      yield next;
      this.body = 'Hello';
    });

    b.use(function *(next){
      yield next;
      this.body = 'World';
    });

    app.use(mount('/hello', a));
    app.use(mount('/world', b));

    request(app.listen())
    .get('/hello')
    .expect('Hello')
    .end(function(err){
      if (err) return done(err);

      request(app.listen())
      .get('/world')
      .expect('World')
      .end(function(err){
        if (err) return done(err);

        request(app.listen())
        .get('/')
        .expect(404, done);
      });
    });
  })

  it('should cascade properly', function(done){
    var app = koa();
    var a = koa();
    var b = koa();
    var c = koa();

    a.use(function *(next){
      yield next;
      if (!this.body) this.body = 'foo';
    });

    b.use(function *(next){
      yield next;
      if (!this.body) this.body = 'bar';
    });

    c.use(function *(next){
      yield next;
      this.body = 'baz';
    });

    app.use(mount('/foo', a));
    a.use(mount('/bar', b));
    b.use(mount('/baz', c));

    request(app.listen())
    .get('/')
    .expect(404)
    .end(function(err){
      if (err) return done(err);

      request(app.listen())
      .get('/foo')
      .expect('foo')
      .end(function(err){
        if (err) return done(err);

        request(app.listen())
        .get('/foo/bar')
        .expect('bar')
        .end(function(err){
          if (err) return done(err);

          request(app.listen())
          .get('/foo/bar/baz')
          .expect('baz', done);
        });
      });
    });
  })

  it('should restore prefix for mounted apps', function(done){
    var app = koa();
    var a = koa();
    var b = koa();
    var c = koa();

    a.use(function *(next){
      this.body = 'foo';
      yield next;
    });

    b.use(function *(next){
      this.body = 'bar';
      yield next;
    });

    c.use(function *(next){
      this.body = 'baz';
      yield next;
    });

    app.use(mount('/foo', a));
    app.use(mount('/foo/bar', b));
    app.use(mount('/foo/bar/baz', c));

    request(app.listen())
    .get('/foo/bar')
    .expect('bar', done);
  })

  it('should restore prefix for mounted middleware', function(done){
    var app = koa();
    var a = koa();

    app.use(mount('/foo', function *(next){
      this.body = 'foo';
      yield next;
    }));

    app.use(mount('/foo/bar', function *(next){
      this.body = 'bar';
      yield next;
    }));

    app.use(mount('/foo/bar/baz', function *(next){
      this.body = 'baz';
      yield next;
    }));

    request(app.listen())
    .get('/foo/bar')
    .expect('bar', done);
  })

  it('should have the correct path', function(done){
    var app = koa();
    var a = koa();

    a.use(function *(next){
      this.path.should.equal('/');
      yield next;
      this.path.should.equal('/');
    });

    app.use(function *(next){
      this.path.should.equal('/foo');
      yield next;
      this.path.should.equal('/foo');
    });

    app.use(mount('/foo', a));

    request(app.listen())
    .get('/foo')
    .end(done);
  });

  describe('when middleware is passed', function(){
    it('should mount', function(done){
      function *hello(next){
        yield next;
        this.body = 'Hello';
      }

      function *world(next){
        yield next;
        this.body = 'World';
      }

      var app = koa();

      app.use(mount('/hello', hello));
      app.use(mount('/world', world));

      request(app.listen())
      .get('/hello')
      .expect('Hello')
      .end(function(err){
        if (err) return done(err);

        request(app.listen())
        .get('/world')
        .expect('World', done);
      });
    })
  })

  describe('when multiple middlewares are passed', function() {
    var app = new koa();

    var say = text => function *(next) {
      this.body = text;
      yield next;
    };

    var setStatus = status => function *() {
      this.status = status;
    };

    app.use(mount('/hello', [say('hello'), setStatus(201)]));
    app.use(mount('/world', [say('world'), setStatus(200)]));
    app.use(mount('/prefix', function *() {
      this.status = 204;
    }));

    var server = app.listen();

    it('should match /prefix', function(done) {
      request(server)
        .get('/prefix')
        .expect(204, done)
    })

    it('should match /hello', function(done){
      request(server)
      .get('/hello')
      .end(function (err, res) {
        should.not.exists(err);
        should.exists(res);
        res.statusCode.should.be.equal(201);
        should.exists(res.text);
        res.text.should.be.equal('hello');
        done();
      })
    })

    it('should match /world', function(done){
      request(server)
      .get('/world')
      .end(function (err, res) {
        should.not.exists(err);
        should.exists(res);
        res.statusCode.should.be.equal(200);
        should.exists(res.text);
        res.text.should.be.equal('world');
        done();
      })
    })
  })
})

describe('mount(/prefix)', function(){
  var app = koa();

  app.use(mount('/prefix', function* () {
    this.status = 204;
  }));

  var server = app.listen();

  it('should not match /kljasdf', function(done){
    request(server)
    .get('/kljasdf')
    .expect(404, done);
  })

  it('should not match /prefixlaksjdf', function(done){
    request(server)
    .get('/prefixlaksjdf')
    .expect(404, done);
  })

  it('should match /prefix', function(done){
    request(server)
    .get('/prefix')
    .expect(204, done);
  })

  it('should match /prefix/', function(done){
    request(server)
    .get('/prefix/')
    .expect(204, done);
  })

  it('should match /prefix/lkjasdf', function(done){
    request(server)
    .get('/prefix/lkjasdf')
    .expect(204, done);
  })
})

describe('mount(/prefix/)', function(){
  var app = koa();

  app.use(mount('/prefix/', function* () {
    this.status = 204;
  }));

  var server = app.listen();

  it('should not match /kljasdf', function(done){
    request(server)
    .get('/kljasdf')
    .expect(404, done);
  })

  it('should not match /prefixlaksjdf', function(done){
    request(server)
    .get('/prefixlaksjdf')
    .expect(404, done);
  })

  it('should not match /prefix', function(done){
    request(server)
    .get('/prefix')
    .expect(404, done);
  })

  it('should match /prefix/', function(done){
    request(server)
    .get('/prefix/')
    .expect(204, done);
  })

  it('should match /prefix/lkjasdf', function(done){
    request(server)
    .get('/prefix/lkjasdf')
    .expect(204, done);
  })
})
