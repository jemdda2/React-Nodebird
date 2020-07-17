import React from 'react';
import Document, { Html, Head, Main, NextScript } from 'next/document';
import { ServerStyleSheet } from 'styled-components';

export default class MyDocument extends Document {
	static async getInitialProps(ctx) {
		const sheet = new ServerStyleSheet();
		const originalRenderPage = ctx.renderPage;
		try {
			ctx.renderPage = () => originalRenderPage({
				enhanceApp: (App) => (props) => sheet.collectStyles(<App {...props} />)
			});
			const initialProps = await Document.getInitialProps(ctx);
			return {
				...initialProps,
				styles: (
					<>
						{initialProps.styles}
						{sheet.getStyleElement()}
					</>
				),
			};
		} catch (error) {
			console.log(error);
		} finally {
			sheet.seal();
		}
	}

	render() {
		<Html>
			<Head />
			<body>
				{/* polyfill.io/v3/url-builder/ */}
				<script src="https://polyfill.io/v3/polyfill.min.js?features=es2019%2Ces2018%2Ces2017%2Ces2016%2Ces2015%2Cdefault" />
				<Main />
				<NextScript />
			</body>
		</Html>
	}
}