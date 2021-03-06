from django.shortcuts import render, redirect
from seat.applications.AuthenticationApplication import AuthenticationApplication
from seat.applications.RoutingApplication import RoutingApplication
import logging

authenticationApplication = AuthenticationApplication()
routingApplication = RoutingApplication()
logger = logging.getLogger('login')

def login(request):
    error = request.session.get('msg')
    if 'user_id' in request.session:
        print "Logging out user with id at login page:", request.session['user_id'] 
    for key in request.session.keys():
        del request.session[key]
    request.session.flush()

    pass_through = request.COOKIES.get('pass_through')

    if (request.method == 'GET'):
        return render(request, 'login/login.html', {'error': error})
    elif (request.method == 'POST'):
        try:
            logger.info('trying to authenticate %s' % request.POST['username'])
            user, is_teacher = authenticationApplication.authenticate(
                username = request.POST['username'],
                password = request.POST['password'])
            request.session['user_id'] = user.id
            request.session['is_teacher'] = is_teacher
            
            if pass_through is not None:
                response = redirect(pass_through)
                response.delete_cookie('pass_through')
                return response

            if is_teacher:
                return redirect(routingApplication.teacher_index())
            else:
                return redirect(routingApplication.student_index())

        except AssertionError as error:
            logger.debug('Failed to authenticate user due to error: ' + str(error))
            context = { 'error': str(error).capitalize() }
            return render(request, 'login/login.html', context)
        except NameError as error:
            logger.debug("failed to auth user")
            context = { 'error': "User not found" }
            return render(request, 'login/login.html', context)
        except Exception as error:
            logger.debug('Failed to authenticate user due to error: ' + str(error))
            context = { 'error': "The server encountered an error" }
            return render(request, 'login/login.html', context)
