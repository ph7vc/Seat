from django.db import models
from seat.models.exam import Exam
from django.utils.crypto import get_random_string

def random_token():
    return get_random_string(length=7)

class Token(models.Model):
    """key to taking an exam"""
    token = models.CharField(default=random_token, unique=True, max_length=7)
    exam = models.ForeignKey(Exam)
    open = models.BooleanField(default=True)
    released = models.BooleanField(default=False)
    deleted = models.BooleanField(default=False)