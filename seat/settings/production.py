try:
    from shared import *
except:
    pass

with open(os.path.join(BASE_DIR, 'seat/settings/secret.key')) as f:
    SECRET_KEY = f.read().strip()

DEBUG = False
TEMPLATE_DEBUG = False
ALLOWED_HOSTS = ['*']

# Database
DATABASES = {
    'default':{
        'NAME'      : 'seat',
        'ENGINE'    : 'django.db.backends.mysql',
        'USER'      : 'capstone',
        'PASSWORD'  : '9324d1eb',
        'HOST'      : '',
        'PORT'      : ''
    }
}