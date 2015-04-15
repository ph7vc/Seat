from django.shortcuts import render, redirect
from seat.applications.AuthenticationApplication import AuthenticationApplication
from seat.applications.RoutingApplication import RoutingApplication
import logging

authenticationApplication = AuthenticationApplication()
routingApplication = RoutingApplication()
logger = logging.getLogger('login')

def login(request):
    if (request.method == 'GET'):
        return render(request, 'login/login.html')
    elif (request.method == 'POST'):
        try:
            logger.info('trying to authenticate %s' % request.POST['username'])
            user, is_teacher = authenticationApplication.authenticate(
                username = request.POST['username'],
                password = request.POST['password'])
            request.session['user_id'] = user.id
            request.session['is_teacher'] = is_teacher
            
            if is_teacher:
                return redirect(routingApplication.teacher_index())
            else:
                return redirect(routingApplication.student_index())
        except Exception as error:
            logger.info('Failed to authenticate user due to error: ' + str(error))
            context = { 'error': str(error).capitalize() }
            return render(request, 'login/login.html', context)
