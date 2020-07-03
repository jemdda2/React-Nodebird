const express = require('express');
const bcrype = require('bcrypt');
const passport = require('passport');

const { User, Post } = require('../models');
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
})

module.exports = router;