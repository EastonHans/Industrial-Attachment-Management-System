# Generated migration to add supervision visits tracking

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='reimbursement',
            name='supervision_visits',
            field=models.IntegerField(default=1, help_text='Number of actual supervision visits'),
        ),
    ]