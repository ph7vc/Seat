from django.shortcuts import render
from django.conf import settings
from django.core import serializers

class ExceptionMiddleware(object):
	def process_exception(self, request, exception):
		if not settings.DEBUG:
			return render(request, '/500.html')
		else:
			print request, exception
			return request