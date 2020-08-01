const express = require('express');
const bcrype = require('bcrypt');
const passport = require('passport');
const { Op } = require('sequelize');

const { User, Post, Image, Comment } = require('../models');
const { isLoggedIn, isNotLoggedIn } = require('./middlewares');

const router = express.Router();

router.get('/', async (req, res, next) => { // GET /user
	try {
		if (req.user) {
			const fullUserWithoutPassword = await User.findOne({
				where: { id: req.user.id },
				attributes: {
					exclude: ['password']
				},
				include: [{
					model: Post,
					attributes: ['id'],
				}, {
					model: User,
					as: 'Followings',
					attributes: ['id'],
				}, {
					model: User,
					as: 'Followers',
					attributes: ['id'],
				}]
			})
			res.status(200).json(fullUserWithoutPassword);
		} else {
			res.status(200).json(null);
		}
	} catch (error) {
		console.error(error);
		next(error);
	}
})

router.get('/followers', isLoggedIn, async (req, res, next) => { // GET /user/followers
	try{
		const user = await User.findOne({ where: { id: req.user.id }});
		if (!user) {
			res.status(403).send('없는 사람은 팔로우할수 없습니다.');
		}
		const followers = await user.getFollowers({
			limit: parseInt(req.query.limit, 10),
		});
		res.status(200).json(followers);
	} catch (error) {
		console.error(error);
		next(error);
	}
});

router.get('/followings', isLoggedIn, async (req, res, next) => { // GET /user/followings
	try{
		const user = await User.findOne({ where: { id: req.user.id }});
		if (!user) {
			res.status(403).send('없는 사람은 팔로우할수 없습니다.');
		}
		const followings = await user.getFollowings({
			limit: parseInt(req.query.limit, 10),
		});
		res.status(200).json(followings);
	} catch (error) {
		console.error(error);
		next(error);
	}
});

router.get('/:userId', async (req, res, next) => { // GET /user/1
	try {
		const fullUserWithoutPassword = await User.findOne({
			where: { id: req.params.userId },
			attributes: {
				exclude: ['password']
			},
			include: [{
				model: Post,
				attributes: ['id'],
			}, {
				model: User,
				as: 'Followings',
				attributes: ['id'],
			}, {
				model: User,
				as: 'Followers',
				attributes: ['id'],
			}]
		})
		if (fullUserWithoutPassword) {
			const data = fullUserWithoutPassword.toJSON();
			data.Posts = data.Posts.length;	// 개인정보 침해 예방
			data.Followings = data.Followings.length;
			data.Followers = data.Followers.length;
			res.status(200).json(data);
		} else {
			res.status(404).json('존재하지 않는 사용자입니다.');
		}
	} catch (error) {
		console.error(error);
		next(error);
	}
})

router.get('/:userId/posts', async (req, res, next) => { // GET /posts/1/posts
	try {
    const where = { UserId: req.params.userId };
    if (parseInt(req.query.lastId, 10)) { // 초기 로딩이 아닐 때
      where.id = { [Op.lt]: parseInt(req.query.lastId, 10)} // 보다 작은
    } // 21 20 19 18 17 16 15 14 13 12 11 10 9 8 7 6 5 4 3 2 1
    const posts = await Post.findAll({
      where,
      limit: 10,
      order: [['createdAt', 'DESC']],
      include: [{
        model: User,
        attributes: ['id', 'nickname'],
      }, {
        model: Image,
      }, {
        model: Comment,
        include: [{
          model: User,　// 댓글 작성자
          attributes: ['id', 'nickname'],
          order: [['createdAt', 'DESC']],
        }],
      }, {
        model: User, // 좋아요 누른 사람
        as: 'Likers',
        attributes: ['id'],
      }, {
        model: Post,
        as: 'Retweet',
        include: [{
          model: User,
          attributes: ['id', 'nickname'],
        }, {
          model: Image,
        }]
      }],
		});
		res.status(200).json(posts);
	} catch (error) {
		console.error(error);
		next(error);
	}
});

router.post('/login', isNotLoggedIn, (req, res, next) => { // 미들웨어 확장
	passport.authenticate('local', (err, user, info) => {
		if (err) { // 서버에러
			console.error(err);
			return next(err);
		}
		if (info) { // 클라이언트에러
			return res.status(401).send(info.reason);
		}
		return req.login(user, async (loginErr) => {  //passport로그인에러
			if (loginErr) {
				console.error(loginErr);
				return next(loginErr);
			}
			const fullUserWithoutPassword = await User.findOne({
				where: { id: user.id },
				attributes: {
					exclude: ['password']
				},
				include: [{
					model: Post,
					attributes: ['id'],
				}, {
					model: User,
					as: 'Followings',
					attributes: ['id'],
				}, {
					model: User,
					as: 'Followers',
					attributes: ['id'],
				}]
			})
			return res.status(200).json(fullUserWithoutPassword);
		})
	})(req, res, next);
});

router.post('/', async (req, res, next) => { // POST /user/
	try{
		const exUser = await User.findOne({
			where: {
				email: req.body.email,
			}
		});
		if(exUser) {
			return res.status(403).send('이미 사용중인 아이디입니다.');
		}
		const hashedPassword = await bcrype.hash(req.body.password, 10); // 10은 암호화 복잡도
		await User.create({
			email: req.body.email,
			nickname: req.body.nickname,
			password: hashedPassword,
		});
		// res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3060'); // 브라우저에서 접근허용
		res.status(200).send('ok!');
	} catch (error) {
		console.error(error);
		next(error); // express가 브라우저에 에러를 알아서 보내줌 status 500 서버쪽 에러
	}
});

router.post('/logout', isLoggedIn, (req, res) => {
	req.logout();
	req.session.destroy();
	res.send('ok');
});

router.patch('/nickname', isLoggedIn, async (req, res, next) => {
	try{
		await User.update({
			nickname: req.body.nickname,
		}, {
			where: { id: req.user.id },
		});
		res.status(200).json({ nickname: req.body.nickname });
	} catch (error) {
		console.error(error);
		next(error);
	}
});

router.patch('/:userId/follow', isLoggedIn, async (req, res, next) => { // PATCH /user/1/follow
	try{
		const user = await User.findOne({ where: { id: req.params.userId }});
		if (!user) {
			res.status(403).send('없는 사람은 팔로우할수 없습니다.');
		}
		await user.addFollowers(req.user.id);
		res.status(200).json({ UserId: parseInt(req.params.userId, 10) });
	} catch (error) {
		console.error(error);
		next(error);
	}
});

router.delete('/:userId/follow', isLoggedIn, async (req, res, next) => { // DELETE /user/1/follow
	try{
		const user = await User.findOne({ where: { id: req.params.userId }});
		if (!user) {
			res.status(403).send('없는 사람은 언팔로우할수 없습니다.');
		}
		await user.removeFollowers(req.user.id);
		res.status(200).json({ UserId: parseInt(req.params.userId, 10) });
	} catch (error) {
		console.error(error);
		next(error);
	}
});

router.delete('/follower/:userId', isLoggedIn, async (req, res, next) => { // DELETE /user/follower/2
	try{
		const user = await User.findOne({ where: { id: parseInt(req.params.userId, 10) }});
		if (!user) {
			res.status(403).send('없는 사람은 차단할수 없습니다.');
		}
		await user.removeFollowings(req.user.id);
		res.status(200).json({ UserId: parseInt(req.params.userId, 10) });
	} catch (error) {
		console.error(error);
		next(error);
	}
});

module.exports = router;