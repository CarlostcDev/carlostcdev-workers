export const swaggerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
	<title>FIDS API Documentation</title>
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
	window.onload = () => {
		SwaggerUIBundle({
			url: "/openapi.json",
			dom_id: "#swagger-ui",
			deepLinking: true,
			presets: [SwaggerUIBundle.presets.apis],
			layout: "BaseLayout"
		});
	};
</script>
</body>
</html>`;
